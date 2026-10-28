"""SYNTHETIC records for isolated tests only. Never import from production runtime."""
import json
from app.services import official_resources as resources
DLI_HTML='<table><tr><td>Ontario</td><td>SYNTHETIC Maple College</td><td>O999999999991</td><td>Ottawa</td></tr><tr><td>Quebec</td><td>SYNTHETIC Laurent School</td><td>O999999999992</td><td>Montreal</td></tr></table>'
CENTRE_HTML='<div class="home_map_box home_map_box_full"><h5>SYNTHETIC CELPIP Centre</h5><div class="text">1 Example Road, Ottawa, ON K1A 0A1, Canada</div><a href="https://www.celpip.ca/centre/synthetic-only/">Info</a></div>'

def synthetic_source(key):
 if key=='dli': return DLI_HTML
 if key=='celpip': return CENTRE_HTML
 if key=='tcf': raise ValueError('source_access_restricted')
 if key.startswith('processing_') or key.startswith('json_non_country_'):
  return json.dumps({'default-update':{'lastupdated':'October 21, 2026'},'visitor_inside_canada':{'visitor_inside_canada':'12 days'},'study_extension':{'study_extension':'56 days'}})
 if key.startswith('json_country_'): return json.dumps({'visitor-outside-canada':{'FR':'37 days','CA':'Not available'},'study':{'FR':'6 weeks'}})
 if key.startswith('json_names_'): return json.dumps({'country-name':{'FR':'France','CA':'Canada'}})
 if key=='pte':
  return json.dumps({'Canada':{'test_centers':[{'center_name':'SYNTHETIC pte Centre','city':'Ottawa','country':'Canada','address':'1 Example Road'}]}})
 if key in resources.PROVIDERS:
  return '<script type="application/ld+json">'+json.dumps({'@type':'TestCenter','name':'SYNTHETIC '+key+' Centre','address':{'addressLocality':'Ottawa','addressRegion':'ON','streetAddress':'1 Example Road'}})+'</script>'
 raise ValueError('unsupported_synthetic_source')

def install():
 resources._read_source=synthetic_source
