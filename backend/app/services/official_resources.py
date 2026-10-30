"""Bounded public-reference adapters. Never run remote code or activate rules."""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import hashlib
import ipaddress
import json
import re
import socket
import threading
import time
import unicodedata
from urllib.parse import urlsplit
import requests

DLI = 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html'
PROVIDERS = {
 'celpip': ('CELPIP-General', 'https://www.celpip.ca/take-celpip/find-a-test-date/'),
 'ielts': ('IELTS General Training', 'https://ielts.org/test-centres'),
 'pte': ('PTE Core', 'https://www.pearsonpte.com/pte-core/'),
 'tef': ('TEF Canada', 'https://www.lefrancaisdesaffaires.fr/candidat/trouver-un-centre-agree/'),
 'tcf': ('TCF Canada', 'https://www.france-education-international.fr/centres-d-examen/carte'),
}
SOURCES = {'dli': DLI, **{k:v[1] for k,v in PROVIDERS.items()}}
# Fixed public contracts verified from the provider's own directory. This is
# deliberately a supported subset for IELTS/TEF, not a worldwide coverage claim.
SOURCES.update({
 'ielts':'https://ielts.org/test-centres/ces-toronto-ces-exams',
 'ielts_extra':'https://ielts.org/test-centres/idp-ielts-canada-toronto',
 'tef':'https://francais.cci-paris-idf.fr/inscription-candidat/contact/337/2',
 'tef_extra':'https://francais.cci-paris-idf.fr/inscription-candidat/contact/476/2',
 'pte':'https://www.pearsonpte.com/bin/pearson/azure-blob-access',
})
for _language in ('en','fr'):
 SOURCES['draws_'+_language]='https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_'+_language+'.json'
 SOURCES['processing_'+_language]='https://www.canada.ca/content/dam/ircc/documents/json/data-ptime-non-country-'+_language+'.json'
 for _part,_file in [('country','data-ptime-'),('non_country','data-ptime-non-country-'),('names','data-country-name-')]:
  SOURCES['json_'+_part+'_'+_language]='https://www.canada.ca/content/dam/ircc/documents/json/'+_file+_language+'.json'
MAX_BYTES = 2_000_000
FRESH_SECONDS = 3600
STALE_SECONDS = 86400
_LOCK = threading.Lock()
_CACHE = OrderedDict()
_PENDING = {}
_FAILED = {}
_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix='official-resource')


def now():
 return datetime.now(timezone.utc)


def _read_source(key):
 """Fixed URLs only; every address must be public. Redirects are not followed."""
 url = SOURCES[key]
 host = urlsplit(url).hostname
 addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
 if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
  raise ValueError('non_public_source')
 with requests.get(url, stream=True, timeout=(2, 3), allow_redirects=False,
                   headers={'User-Agent':'NorthBridgeAI-OfficialResources/1.0'}) as response:
  response.raise_for_status()
  if response.status_code != 200: raise ValueError('source_redirect')
  started=time.monotonic()
  content = bytearray()
  for chunk in response.iter_content(32768):
   if time.monotonic()-started>6: raise ValueError("source_deadline")
   content.extend(chunk)
   if len(content) > MAX_BYTES: raise ValueError('source_size')
  text = bytes(content).decode('utf-8-sig', errors='strict')
  if 'ERR-BOT-403' in text or 'Access Denied' in text: raise ValueError('source_access_restricted')
  return text


def plain(value):
 return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]*>', ' ', value))).strip()[:500]


class Rows(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.rows=[]; self.row=None; self.cell=None
 def handle_starttag(self, tag, attrs):
  if tag=='tr': self.row=[]
  if tag=='td' and self.row is not None: self.cell=[]
 def handle_data(self, value):
  if self.cell is not None: self.cell.append(value)
 def handle_endtag(self, tag):
  if tag=='td' and self.cell is not None and self.row is not None:
   self.row.append(plain(' '.join(self.cell))); self.cell=None
  if tag=='tr' and self.row is not None:
   if len(self.rows)<10000: self.rows.append(self.row)
   self.row=None


def record(kind, name, source, **fields):
 identity = '|'.join(str(x) for x in (kind,name,fields.get('dli_number'),fields.get('address'),fields.get('city'),fields.get('provider'),fields.get('country')))
 return {'id':hashlib.sha256(identity.encode()).hexdigest()[:32], 'kind':kind, 'name':name,
         'source_url':source, 'review_status':'SOURCE_RECORD_NOT_ELIGIBILITY_REVIEW', **fields}


def parse_dli(text):
 parser=Rows(); parser.feed(text); result={}
 for cells in parser.rows:
  if len(cells)<4 or not re.fullmatch(r'O\d{8,15}', cells[2]): continue
  province,name,dli,city=cells[:4]
  if not name or not province or not city: continue
  item=record('dli',name,DLI,province=province,city=city,dli_number=dli,
              designation_status='listed_in_official_source',pgwp_eligibility='not_assessed',study_permit_eligibility='not_assessed')
  result[item['id']]=item
 if not result: raise ValueError('dli_schema_unavailable')
 return list(result.values())


def parse_centres(provider, text, source_url=None):
 title,booking=PROVIDERS[provider]
 url=source_url or SOURCES[provider]
 result={}
 if provider=='pte' and text.lstrip().startswith('{'):
  payload=json.loads(text)
  if not isinstance(payload,dict): raise ValueError('pte_schema')
  for country,group in list(payload.items())[:300]:
   if not isinstance(group,dict) or not isinstance(group.get('test_centers'),list): continue
   for row in group['test_centers'][:500]:
    if not isinstance(row,dict) or not all(isinstance(row.get(k),str) and row[k].strip() for k in ('center_name','city','address')): continue
    name=plain(row['center_name']);address=plain(row['address']);city=plain(row['city'])
    region=re.search(r'\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)$',name) if str(country).casefold()=='canada' else None
    item=record('test_centre',name,url,provider=provider,test_type=title,test_offering_status='not_verified',city=city,province=region.group(1) if region else None,address=address,country=plain(str(country)),booking_url=booking,availability='not_verified')
    result[item['id']]=item
  if not result:raise ValueError('pte_centres_unavailable')
  return list(result.values())
 if provider=='ielts' and 'test-center-header__title' in text:
  name=re.search(r'<h1[^>]*class="[^"]*test-center-header__title[^"]*"[^>]*>(.*?)</h1>',text,re.S)
  block=re.search(r'<h5[^>]*>Address</h5>(.*?)</div>',text,re.S)
  available=text.split('class="ielts-tests-available"',1)[-1] if 'class="ielts-tests-available"' in text else ''
  tests=[plain(v) for v in re.findall(r'<h6[^>]*>(.*?)</h6>',available,re.S)]
  if name and block and any('General Training' in test for test in tests):
   parts=[plain(v) for v in re.findall(r'<p[^>]*>(.*?)</p>',block.group(1),re.S)]
   provinces={'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Nova Scotia','Ontario','Prince Edward Island','Quebec','Saskatchewan'}
   province=next((v for v in parts if v in provinces or re.fullmatch(r'ON|QC|BC|AB|MB|NB|NL|NS|PE|SK',v)),None)
   region_index=parts.index(province) if province else None
   postal_index=next((i for i,v in enumerate(parts) if re.fullmatch(r'[A-Z]\d[A-Z]\s?\d[A-Z]\d',v)),None)
   city_index=region_index-1 if region_index is not None else postal_index-1 if postal_index is not None else None
   if city_index is not None and city_index>=1:
    item=record('test_centre',plain(name.group(1)),url,provider=provider,test_type=title,test_offering_status='listed_in_source_not_booking_availability',city=parts[city_index],province=province,address=', '.join(parts),booking_url=url,availability='not_verified')
    return [item]
  raise ValueError('ielts_centre_contract_unavailable')
 if provider=='tef' and 'summary__title' in text:
  name=re.search(r'<h3[^>]*class="summary__title"[^>]*>(.*?)</h3>',text,re.S)
  values={plain(label).rstrip(' :'):plain(value) for label,value in re.findall(r'<span class="info-list__label">(.*?)</span>\s*<span class="info-list__value">(.*?)</span>',text,re.S)}
  address=values.get('Adresse','');test=values.get('Test / Diplôme','')
  city=re.search(r'[A-Z]\d[A-Z]\s?\d[A-Z]\d\s+(.+?)\s*-\s*Canada',address,re.I)
  if name and test=='TEF Canada' and city:
   item=record('test_centre',plain(name.group(1)),url,provider=provider,test_type=title,test_offering_status='listed_in_source_not_booking_availability',city=city.group(1).strip(),province=None,address=address,booking_url=url,availability='not_verified')
   return [item]
  raise ValueError('tef_centre_contract_unavailable')
 if provider=='celpip':
  pattern=r'<div class="home_map_box[^"]*">.{0,300}?<h5>(.*?)</h5>.{0,500}?<div class="text">(.*?)</div>.{0,500}?<a href="(https://www\.celpip\.ca/centre/[^"<>]+)"'
  for name,address,detail in re.findall(pattern,text,re.S):
   name,address=plain(name),plain(address)
   if not name or not address: continue
   city=None;province=None
   match=re.search(r',\s*([^,]+),\s*(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b',address)
   if match:city,province=match.groups()
   item=record('test_centre',name,url,provider=provider,test_type=title,test_offering_status='not_verified',address=address,city=city,province=province,detail_url=detail,booking_url=booking,availability='not_verified')
   result[item['id']]=item
 # Only explicit TestCenter objects qualify; organization addresses are not centres.
 for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',text,re.S):
  try:data=json.loads(raw)
  except (ValueError,TypeError):continue
  queue=data if isinstance(data,list) else [data];visited=0
  while queue and visited<1000:
   node=queue.pop(0);visited+=1
   if not isinstance(node,dict):continue
   if isinstance(node.get('@graph'),list):queue.extend(node['@graph'][:500])
   address=node.get('address');types=node.get('@type',[])
   if isinstance(types,str):types=[types]
   if not isinstance(address,dict) or 'TestCenter' not in types:continue
   if not node.get('name') or not address.get('addressLocality'):continue
   name=plain(str(node['name']));city=plain(str(address['addressLocality']))
   item=record('test_centre',name,url,provider=provider,test_type=title,test_offering_status='not_verified',city=city,province=plain(str(address.get('addressRegion',''))),address=plain(str(address.get('streetAddress',''))),booking_url=booking,availability='not_verified')
   result[item['id']]=item
 if not result:raise ValueError('structured_centres_unavailable')
 return list(result.values())


def _refresh(key):
 text=_read_source(key)
 if key.startswith('processing_'):
  from app.services.immigration_intelligence_service import normalize_official_processing
  language=key.split('_')[-1]
  feeds={part:json.loads(text if part=='non_country' else _read_source('json_'+part+'_'+language)) for part in ('country','non_country','names')}
  rows=normalize_official_processing(feeds,language)
  text=json.dumps(feeds,sort_keys=True)
 else:
  rows=parse_dli(text) if key=='dli' else parse_centres(key,text)
  if key in ('ielts','tef'):
   try:
    extra_text=_read_source(key+'_extra')
    rows.extend(parse_centres(key,extra_text,SOURCES[key+'_extra']))
    rows=list({r['id']:r for r in rows}.values())
    text+=extra_text
   except Exception:
    pass  # Coverage remains explicitly partial; never invent the missing record.
 observed=now()
 value={'status':'available','records':rows,'retrieved_at':observed.isoformat(),
        'expires_at':(observed+timedelta(seconds=FRESH_SECONDS)).isoformat(),
        'source_updated_at':None,'source_url':SOURCES[key],
        'review_status':'SOURCE_RECORD_NOT_ELIGIBILITY_REVIEW','coverage':'supported_source_subset','content_sha256':hashlib.sha256(text.encode()).hexdigest(),
        'partial_provider_coverage':key in {'ielts','tef'},
        'appointments_verified':False,'prices_verified':False}
 with _LOCK:
  _CACHE[key]=(observed,value); _CACHE.move_to_end(key)
  while len(_CACHE)>len(SOURCES): _CACHE.popitem(last=False)
 return value


def _finished(key, future):
 with _LOCK:
  if future.exception() is not None: _FAILED[key]=now()
  if future.exception() is None: _FAILED.pop(key,None)
  if _PENDING.get(key) is future: _PENDING.pop(key,None)


def _snapshot_reader(key):
 from app.services.official_resource_snapshots import read_snapshot
 return read_snapshot(key)


def resource_data(key):
 if key not in {'dli',*PROVIDERS,'processing_en','processing_fr','draws_en','draws_fr'}: raise ValueError('unsupported_source')
 if key in {'dli','processing_en','processing_fr','draws_en','draws_fr'}: return _snapshot_reader(key)
 with _LOCK:
  cached=_CACHE.get(key); age=(now()-cached[0]).total_seconds() if cached else None
  if cached and age<FRESH_SECONDS: return deepcopy(cached[1])
  failure=_FAILED.get(key)
  future=_PENDING.get(key)
  created=False
  if not future and (not failure or (now()-failure).total_seconds()>60):
   future=_POOL.submit(_refresh,key); _PENDING[key]=future; created=True
 # Register outside the lock: completed futures invoke callbacks immediately.
 if created: future.add_done_callback(lambda f: _finished(key,f))
 if future:
  try: return deepcopy(future.result(timeout=0.25))
  except Exception: pass
 if cached and age<STALE_SECONDS: return {**deepcopy(cached[1]),'status':'stale'}
 return {'status':'loading' if future and not future.done() else 'unavailable','records':[],
         'retrieved_at':None,'expires_at':None,'source_updated_at':None,
         'source_url':SOURCES[key],'reason':'source_not_reliably_available','review_status':'NOT_VERIFIED',
         'coverage':'no_supported_records','appointments_verified':False,'prices_verified':False}


def search(key, query='', province='', city='', offset=0, limit=25):
 payload=resource_data(key)
 def norm(x): return ''.join(c for c in unicodedata.normalize('NFKD',str(x or '').casefold()) if not unicodedata.combining(c))
 from app.rules.program_registry import jurisdiction
 def same_province(a,b):
  return (jurisdiction(a) is not None and jurisdiction(a)==jurisdiction(b)) or norm(a)==norm(b)
 rows=[r for r in payload['records'] if norm(query) in norm(' '.join(str(r.get(k) or '') for k in ['name','dli_number','address','test_type']))
       and (not province or same_province(province,r.get('province'))) and (not city or norm(city) in norm(r.get('city')))]
 return {**{k:v for k,v in payload.items() if k!='records'},'records':rows[offset:offset+limit],
         'total':len(rows),'offset':offset,'limit':limit,
         'provinces':sorted({r['province'] for r in payload['records'] if r.get('province')})}


def find_record(kind, identifier, provider=None):
 key='dli' if kind=='dli' else provider
 if key not in SOURCES: return None
 payload=resource_data(key)
 if payload['status']!='available': return None
 return next((r|{'retrieved_at':payload['retrieved_at']} for r in payload['records'] if r['id']==identifier),None)
