"""Provenance and bilingual adversarial matrix from the final RC4 live review."""
import json
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest
import backend.launch_smoke_test
from app.services import ai_advisor
from app.services.chat_contract import generate, boundary_intent, unsafe_prose, OFFICIAL_ACTIONS


def provider(reply='Keep recorded facts separate and mark unresolved questions unknown.', **fields):
    payload = dict(reply=reply, insights=[], limitations=[], actions=['profile'])
    payload.update(fields)
    client = Mock()
    client.chat.completions.create.return_value = NS(choices=[NS(finish_reason='stop',
        message=NS(refusal=None, content=json.dumps(payload)))])
    return client


def run(client, message='Draft a polite question for my adviser.', language='en', context=None):
    return generate(message=message, language=language, context=context or {}, client_factory=lambda: client)


FIXTURES = json.loads((Path(__file__).parent / 'fixtures/targeted_chat_cases.json').read_text(encoding='utf-8'))
CASES = []
for group in FIXTURES:
    CASES.append((group['original_id'], group['exact_prompt'], group['exact_language'], group['intent']))
    other = 'en' if group['exact_language'] == 'fr' else 'fr'
    CASES.append((group['original_id'], group['counterpart'], other, group['intent']))
    for language, prompts in group['paraphrases'].items():
        CASES.extend((group['original_id'], text, language, group['intent']) for text in prompts)


@pytest.mark.parametrize('ident,message,language,intent', CASES)
def test_every_live_issue_and_three_paraphrases_has_useful_owned_guidance(ident, message, language, intent):
    client = provider()
    result = run(client, message, language)
    assert boundary_intent(message) == intent
    client.chat.completions.create.assert_not_called()
    assert result['ai_status'] == 'not_requested'
    assert result['response_mode'] in {'official_handoff', 'product_boundary'}
    assert len(result['reply']) > 150 and result['suggested_next_actions']
    assert 'temporarily unavailable' not in result['reply'] and 'temporairement indisponible' not in result['reply']


# A/B permutations deliberately span sentences and distant clauses. The invariant
# does not search for a particular ordering or require title and duration adjacency.
COMBINATIONS = [
    ('Four years of experience', 'as an administrative officer', 'Quatre ans d’expérience', 'en tant qu’agent administratif'),
    ('Five years of professional experience', 'qualifying under NOC 13100', 'Cinq ans d’expérience professionnelle', 'admissibles selon la CNP 13100'),
    ('Three years of total work', 'all in the selected occupation', 'Trois ans de travail au total', 'tous dans la profession sélectionnée'),
    ('Two years of experience', 'qualifying work because of résumé similarity', 'Deux ans d’expérience', 'travail admissible selon la similarité du CV'),
    ('One year of employment', 'verified by the suggested NOC match', 'Une année d’emploi', 'vérifiée par la suggestion CNP'),
]


def permutations(a, b):
    return [f'{a} {b}.', f'{b}, {a}.', f'{a}. Separate recorded details. {b}.',
            f'{a}; {b}.', f'{b}. Separate recorded details. {a}.',
            f'Can you confirm? {a}. {b}.', f'{a}. {b}. Can you confirm?']


@pytest.mark.parametrize('parts', COMBINATIONS)
@pytest.mark.parametrize('language', ['en', 'fr'])
@pytest.mark.parametrize('field', ['reply', 'insights', 'limitations'])
def test_all_claim_permutations_have_identical_containment(parts, language, field):
    a, b = parts[:2] if language == 'en' else parts[2:]
    outcomes = []
    for claim in permutations(a, b):
        assert unsafe_prose(claim)
        payload = {field: claim if field == 'reply' else [claim]}
        result = run(provider(**payload), language=language)
        assert claim not in json.dumps(result, ensure_ascii=False)
        outcomes.append((result['ai_status'], result['response_mode']))
    assert len(set(outcomes)) == 1
    assert outcomes[0] == (('unavailable', 'fallback') if field == 'reply' else ('available', 'ai'))


@pytest.mark.parametrize('language', ['en', 'fr'])
def test_request_permutations_cannot_promote_context_or_change_semantics(monkeypatch, language):
    profile = NS(experience_years=5, occupation='Administrative officer', noc_code='13100',
                 job_description='Coordinate correspondence', job_duties='Maintain records')
    a, b = (('I have five years total experience', 'My occupation is administrative officer') if language == 'en'
            else ('J’ai cinq ans d’expérience totale', 'Ma profession est agent administratif'))
    results = []
    for prompt in permutations(a, b):
        client = provider()
        monkeypatch.setattr(ai_advisor, '_get_openai_client', lambda: client)
        result = ai_advisor.generate_ai_chat_reply(message=prompt, language=language, profile=profile)
        context = json.loads(client.chat.completions.create.call_args.kwargs['messages'][1]['content'])['unverified_recorded_context']
        facts = context['profile']
        assert 'total_work_experience_years' not in facts
        assert 'occupation_specific_experience_years' not in facts
        assert 'qualifying_immigration_work_years' not in facts
        assert 'displayed separately' in context['work_fact_policy']
        assert facts['occupation']['source'] == 'user_reported_title'
        assert facts['job_duties']['source'] == 'user_provided_duties'
        assert facts['job_description']['source'] == 'user_provided_description'
        assert facts['noc'] == {'code': None, 'recorded': True, 'status': 'suggested_match', 'verified': False}
        assert context['approved_current_rule_data'] == []
        assert '5' in result['insights'][0]  # Exact application-owned total; no inferred tenure.
        assert 'not verified' in result['insights'][0] if language == 'en' else 'pas vérifiées' in result['insights'][0]
        results.append(result)
    assert all(result == results[0] for result in results)


@pytest.mark.parametrize('claim', [
    'En tant qu’agent administratif avec 4 ans d’expérience, vous pourriez envisager une demande.',
    'Therefore this is a strong pathway for you.', 'This improves your chances.',
    'This makes you competitive.', 'This is your best option.', 'This should simplify your application.',
    'Cela améliore vos chances.', 'Ceci vous rend compétitif.', 'C’est votre meilleure option.',
    'Votre expérience est admissible selon la CNP.', 'Your work qualifies under this NOC.',
    'Your NOC qualifies your work.', 'Your résumé meets the qualifying work requirements.',
    'The threshold is 12 months.', 'Le seuil est de douze mois.', 'CLB 7 is required.',
    'The current program is open.', 'Ce programme est actuellement ouvert.',
    'You must use IMM5406.', 'Vous devez utiliser IMM5406.',
    'Thirteen years in this profession.', 'Trente ans dans cette profession.',
    'All your experience occurred in this occupation.',
    'Dans cette profession, toute votre expérience est reconnue.',
    'That boosts your odds.', 'Vous êtes compétitif.',
])
@pytest.mark.parametrize('field', ['reply', 'insights', 'limitations'])
def test_unsupported_implications_rules_and_exact_failure_in_every_prose_field(claim, field):
    assert unsafe_prose(claim)
    result = run(provider(**{field: claim if field == 'reply' else [claim]}))
    assert claim not in json.dumps(result, ensure_ascii=False)


@pytest.mark.parametrize('message', [
    'What are the current provincial criteria?', 'Quels sont les critères provinciaux actuels ?',
    'Give the current CRS tables.', 'Donne les barèmes actuels.',
    'Which form applies?', 'Quel formulaire s’applique ?',
    'What is the current monetary amount?', 'Quel est le montant actuel ?',
    'Is the program open today?', 'Le programme est-il ouvert actuellement ?',
])
def test_unsourced_current_rules_hand_off(message):
    client = provider('The threshold is 12 months.')
    result = run(client, message)
    client.chat.completions.create.assert_not_called()
    assert result['ai_status'] == 'not_requested' and result['suggested_next_actions']


@pytest.mark.parametrize('reply', [
    'Les critères d’admissibilité doivent être vérifiés dans les instructions officielles.',
    'La CNP sert à décrire des professions. Comparez les fonctions avec le texte officiel.',
    'Le SCG concerne le classement. La preuve de fonds concerne les ressources à vérifier.',
    'Vous pouvez organiser les documents par source et signaler les renseignements inconnus.',
    'Bonjour, pourriez-vous préciser les renseignements à fournir ? Merci pour votre aide.',
])
def test_useful_french_provider_prose_is_not_a_keyword_casualty(reply):
    result = run(provider(reply), language='fr')
    assert result['reply'] == reply and result['ai_status'] == 'available'


@pytest.mark.parametrize('message,language', [
    ('Draft an email asking where to find CEC instructions.', 'en'),
    ('Rédige un courriel demandant où trouver les instructions de la CEC.', 'fr'),
    ('Rewrite this sentence: Please clarify the Express Entry question.', 'en'),
    ('Reformule cette phrase : Merci de préciser la question sur Entrée express.', 'fr'),
])
def test_supported_drafting_is_not_disabled_by_program_names(message, language):
    client = provider('Please clarify where to find the official instructions.' if language == 'en'
                      else 'Pourriez-vous préciser où trouver les instructions officielles ?')
    result = run(client, message, language)
    client.chat.completions.create.assert_called_once()
    assert result['ai_status'] == 'available'


@pytest.mark.parametrize('bad', [{'warnings': ['You qualify.']}, {'handoffs': ['You qualify.']},
                               {'actions': ['You qualify.']}, {'actions': [{'label': 'You qualify.', 'route': '/profile'}]}])
def test_no_new_secondary_render_channel(bad):
    result = run(provider(**bad))
    assert result['ai_status'] == 'unavailable'
    assert 'You qualify' not in json.dumps(result)
    assert all(action['route'] in {v[0] for v in OFFICIAL_ACTIONS.values()}
               for action in result['suggested_next_actions'])
