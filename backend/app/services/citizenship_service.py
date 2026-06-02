import random

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.citizenship_models import (
    CitizenshipAnswer,
    CitizenshipQuestion,
    CitizenshipQuizAttempt,
    LanguagePracticeSession,
)


STUDY_SECTIONS = [
    {
        "key": "rights_responsibilities",
        "title_en": "Rights and responsibilities",
        "title_fr": "Droits et responsabilités",
        "summary_en": "Review democratic rights, legal responsibilities, voting, and civic participation.",
        "summary_fr": "Révisez les droits démocratiques, les responsabilités, le vote et la participation civique.",
    },
    {
        "key": "history_symbols",
        "title_en": "History and symbols",
        "title_fr": "Histoire et symboles",
        "summary_en": "Practice key ideas about Canadian history, identity, symbols, and institutions.",
        "summary_fr": "Pratiquez les notions sur l'histoire, l'identité, les symboles et les institutions.",
    },
    {
        "key": "government",
        "title_en": "Government and elections",
        "title_fr": "Gouvernement et élections",
        "summary_en": "Understand Parliament, federalism, elections, and how representatives are chosen.",
        "summary_fr": "Comprenez le Parlement, le fédéralisme, les élections et le choix des représentants.",
    },
    {
        "key": "geography_economy",
        "title_en": "Geography and economy",
        "title_fr": "Géographie et économie",
        "summary_en": "Study provinces, territories, regions, natural resources, and the economy.",
        "summary_fr": "Étudiez les provinces, territoires, régions, ressources naturelles et l'économie.",
    },
]


SAMPLE_QUESTIONS = [
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which of the following is a responsibility of Canadian citizens?",
        "question_text_fr": "Laquelle des options suivantes est une responsabilité des citoyens canadiens?",
        "options_en": ["Serving on a jury when called", "Choosing the Governor General", "Writing federal laws", "Appointing senators"],
        "options_fr": ["Servir dans un jury si convoqué", "Choisir le gouverneur général", "Rédiger les lois fédérales", "Nommer les sénateurs"],
        "correct_option_index": 0,
        "explanation_en": "Citizens may be called for jury duty and are expected to participate in the justice system.",
        "explanation_fr": "Les citoyens peuvent être convoqués comme jurés et doivent participer au système de justice.",
    },
    {
        "section": "government",
        "question_text_en": "Who do Canadians vote for in a federal election?",
        "question_text_fr": "Pour qui les Canadiens votent-ils lors d'une élection fédérale?",
        "options_en": ["A Member of Parliament", "The King", "A Supreme Court judge", "The Governor General"],
        "options_fr": ["Un député", "Le roi", "Un juge de la Cour suprême", "Le gouverneur général"],
        "correct_option_index": 0,
        "explanation_en": "In a federal election, voters choose a Member of Parliament for their riding.",
        "explanation_fr": "Lors d'une élection fédérale, les électeurs choisissent un député pour leur circonscription.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What does the maple leaf commonly symbolize?",
        "question_text_fr": "Que symbolise souvent la feuille d'érable?",
        "options_en": ["Canada", "Only one province", "The Senate", "The court system"],
        "options_fr": ["Le Canada", "Une seule province", "Le Sénat", "Le système judiciaire"],
        "correct_option_index": 0,
        "explanation_en": "The maple leaf is one of Canada's best-known national symbols.",
        "explanation_fr": "La feuille d'érable est l'un des symboles nationaux les plus connus du Canada.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "How many provinces does Canada have?",
        "question_text_fr": "Combien de provinces le Canada compte-t-il?",
        "options_en": ["10", "3", "13", "50"],
        "options_fr": ["10", "3", "13", "50"],
        "correct_option_index": 0,
        "explanation_en": "Canada has 10 provinces and 3 territories.",
        "explanation_fr": "Le Canada compte 10 provinces et 3 territoires.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which right is protected in Canada?",
        "question_text_fr": "Quel droit est protégé au Canada?",
        "options_en": ["Freedom of expression", "The right to ignore all laws", "The right to appoint judges", "The right to avoid taxes"],
        "options_fr": ["La liberté d'expression", "Le droit d'ignorer toutes les lois", "Le droit de nommer les juges", "Le droit d'éviter les impôts"],
        "correct_option_index": 0,
        "explanation_en": "Freedom of expression is a fundamental freedom protected in Canada.",
        "explanation_fr": "La liberté d'expression est une liberté fondamentale protégée au Canada.",
    },
    {
        "section": "government",
        "question_text_en": "What are the three levels of government in Canada?",
        "question_text_fr": "Quels sont les trois ordres de gouvernement au Canada?",
        "options_en": ["Federal, provincial or territorial, and municipal", "Royal, military, and local", "Senate, court, and police", "National, private, and public"],
        "options_fr": ["Fédéral, provincial ou territorial, et municipal", "Royal, militaire et local", "Sénat, tribunal et police", "National, privé et public"],
        "correct_option_index": 0,
        "explanation_en": "Canada has federal, provincial or territorial, and municipal levels of government.",
        "explanation_fr": "Le Canada a des gouvernements fédéral, provinciaux ou territoriaux, et municipaux.",
    },
]

ADDITIONAL_SAMPLE_QUESTIONS = [
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which document protects basic freedoms such as religion, expression, and peaceful assembly?",
        "question_text_fr": "Quel document protege les libertes fondamentales comme la religion, l'expression et les rassemblements pacifiques?",
        "options_en": ["The Canada Health Act", "The Canadian Charter of Rights and Freedoms", "The National Building Code", "The Employment Insurance Act"],
        "options_fr": ["La Loi canadienne sur la sante", "La Charte canadienne des droits et libertes", "Le Code national du batiment", "La Loi sur l'assurance-emploi"],
        "correct_option_index": 1,
        "explanation_en": "The Charter protects fundamental freedoms and democratic, mobility, legal, equality, and language rights.",
        "explanation_fr": "La Charte protege les libertes fondamentales ainsi que les droits democratiques, de mobilite, juridiques, a l'egalite et linguistiques.",
    },
    {
        "section": "government",
        "question_text_en": "What is the role of the opposition parties in Parliament?",
        "question_text_fr": "Quel est le role des partis d'opposition au Parlement?",
        "options_en": ["To question and improve government proposals", "To command the armed forces", "To appoint provincial premiers", "To replace the courts"],
        "options_fr": ["Questionner et ameliorer les propositions du gouvernement", "Commander les forces armees", "Nommer les premiers ministres provinciaux", "Remplacer les tribunaux"],
        "correct_option_index": 0,
        "explanation_en": "Opposition parties review, question, and debate government actions and proposed laws.",
        "explanation_fr": "Les partis d'opposition examinent, questionnent et debattent les actions du gouvernement et les projets de loi.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "Which people are recognized as the first inhabitants of Canada?",
        "question_text_fr": "Quels peuples sont reconnus comme les premiers habitants du Canada?",
        "options_en": ["The Fathers of Confederation", "The first railway workers", "Indigenous peoples", "The first provincial premiers"],
        "options_fr": ["Les Peres de la Confederation", "Les premiers travailleurs du chemin de fer", "Les peuples autochtones", "Les premiers ministres provinciaux"],
        "correct_option_index": 2,
        "explanation_en": "First Nations, Inuit, and Metis peoples are Indigenous peoples of Canada.",
        "explanation_fr": "Les Premieres Nations, les Inuits et les Metis sont des peuples autochtones du Canada.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which region is often associated with the provinces Manitoba, Saskatchewan, and Alberta?",
        "question_text_fr": "Quelle region est souvent associee au Manitoba, a la Saskatchewan et a l'Alberta?",
        "options_en": ["The Prairies", "The Atlantic region", "The Arctic region", "The Pacific coast"],
        "options_fr": ["Les Prairies", "La region de l'Atlantique", "La region arctique", "La cote du Pacifique"],
        "correct_option_index": 0,
        "explanation_en": "Manitoba, Saskatchewan, and Alberta are commonly known as the Prairie provinces.",
        "explanation_fr": "Le Manitoba, la Saskatchewan et l'Alberta sont communement appeles les provinces des Prairies.",
    },
    {
        "section": "government",
        "question_text_en": "What does a bill become after it is passed by Parliament and receives Royal Assent?",
        "question_text_fr": "Que devient un projet de loi apres son adoption par le Parlement et la sanction royale?",
        "options_en": ["A regulation only", "A law", "A campaign promise", "A court order"],
        "options_fr": ["Un reglement seulement", "Une loi", "Une promesse electorale", "Une ordonnance du tribunal"],
        "correct_option_index": 1,
        "explanation_en": "A bill becomes law after parliamentary approval and Royal Assent.",
        "explanation_fr": "Un projet de loi devient une loi apres l'approbation parlementaire et la sanction royale.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which of the following is a democratic right in Canada?",
        "question_text_fr": "Laquelle des options suivantes est un droit democratique au Canada?",
        "options_en": ["Voting in federal, provincial, or territorial elections", "Avoiding jury duty when called", "Appointing senators directly", "Ignoring local laws"],
        "options_fr": ["Voter aux elections federales, provinciales ou territoriales", "Eviter le devoir de jury lorsqu'on est convoque", "Nommer directement les senateurs", "Ignorer les lois locales"],
        "correct_option_index": 0,
        "explanation_en": "Eligible citizens have the right to vote in Canadian elections.",
        "explanation_fr": "Les citoyens admissibles ont le droit de voter aux elections canadiennes.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What event in 1867 created the Dominion of Canada?",
        "question_text_fr": "Quel evenement en 1867 a cree le Dominion du Canada?",
        "options_en": ["Confederation", "The Quiet Revolution", "The Statute of Westminster", "The building of the CN Tower"],
        "options_fr": ["La Confederation", "La Revolution tranquille", "Le Statut de Westminster", "La construction de la tour CN"],
        "correct_option_index": 0,
        "explanation_en": "Confederation in 1867 united the founding provinces into the Dominion of Canada.",
        "explanation_fr": "La Confederation de 1867 a uni les provinces fondatrices au sein du Dominion du Canada.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which province is Canada's most populous province?",
        "question_text_fr": "Quelle province est la plus peuplee du Canada?",
        "options_en": ["Ontario", "Prince Edward Island", "Newfoundland and Labrador", "Saskatchewan"],
        "options_fr": ["L'Ontario", "L'Ile-du-Prince-Edouard", "Terre-Neuve-et-Labrador", "La Saskatchewan"],
        "correct_option_index": 0,
        "explanation_en": "Ontario has the largest population among Canadian provinces.",
        "explanation_fr": "L'Ontario compte la plus grande population parmi les provinces canadiennes.",
    },
    {
        "section": "government",
        "question_text_en": "Who is Canada's Head of State?",
        "question_text_fr": "Qui est le chef d'Etat du Canada?",
        "options_en": ["The Prime Minister", "The Speaker of the House", "The Sovereign", "The Chief Justice"],
        "options_fr": ["Le premier ministre", "Le president de la Chambre", "Le souverain", "Le juge en chef"],
        "correct_option_index": 2,
        "explanation_en": "Canada is a constitutional monarchy, and the Sovereign is the Head of State.",
        "explanation_fr": "Le Canada est une monarchie constitutionnelle, et le souverain est le chef d'Etat.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What does the poppy commonly represent in Canada?",
        "question_text_fr": "Que represente couramment le coquelicot au Canada?",
        "options_en": ["Remembrance of those who served and died in war", "A provincial election", "A national sports team", "A court ceremony"],
        "options_fr": ["Le souvenir des personnes qui ont servi et sont mortes a la guerre", "Une election provinciale", "Une equipe sportive nationale", "Une ceremonie judiciaire"],
        "correct_option_index": 0,
        "explanation_en": "The poppy is worn around Remembrance Day to honour military service and sacrifice.",
        "explanation_fr": "Le coquelicot est porte autour du jour du Souvenir pour honorer le service militaire et le sacrifice.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which statement best describes equality before the law?",
        "question_text_fr": "Quel enonce decrit le mieux l'egalite devant la loi?",
        "options_en": ["Only elected officials must follow the law", "Everyone is treated with equal dignity and protection under the law", "Only citizens can use the courts", "Laws apply only during elections"],
        "options_fr": ["Seuls les elus doivent respecter la loi", "Toute personne est traitee avec une dignite et une protection egales devant la loi", "Seuls les citoyens peuvent utiliser les tribunaux", "Les lois s'appliquent seulement pendant les elections"],
        "correct_option_index": 1,
        "explanation_en": "Canadian legal principles include equal protection and equal benefit of the law.",
        "explanation_fr": "Les principes juridiques canadiens comprennent la protection et le benefice egaux de la loi.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which city is the capital of Canada?",
        "question_text_fr": "Quelle ville est la capitale du Canada?",
        "options_en": ["Toronto", "Ottawa", "Montreal", "Vancouver"],
        "options_fr": ["Toronto", "Ottawa", "Montreal", "Vancouver"],
        "correct_option_index": 1,
        "explanation_en": "Ottawa, Ontario, is Canada's capital city.",
        "explanation_fr": "Ottawa, en Ontario, est la capitale du Canada.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "Which two official languages are used by the federal government?",
        "question_text_fr": "Quelles sont les deux langues officielles utilisees par le gouvernement federal?",
        "options_en": ["English and French", "English and Spanish", "French and Inuktitut", "English and German"],
        "options_fr": ["L'anglais et le francais", "L'anglais et l'espagnol", "Le francais et l'inuktitut", "L'anglais et l'allemand"],
        "correct_option_index": 0,
        "explanation_en": "English and French are Canada's two official languages at the federal level.",
        "explanation_fr": "L'anglais et le francais sont les deux langues officielles du Canada au niveau federal.",
    },
    {
        "section": "government",
        "question_text_en": "What is the name for an electoral district represented by a Member of Parliament?",
        "question_text_fr": "Comment appelle-t-on une circonscription electorale representee par un depute?",
        "options_en": ["A riding", "A ward only", "A ministry", "A senate seat"],
        "options_fr": ["Une circonscription", "Un quartier seulement", "Un ministere", "Un siege au Senat"],
        "correct_option_index": 0,
        "explanation_en": "A federal electoral district is commonly called a riding.",
        "explanation_fr": "Une circonscription electorale federale est souvent appelee une circonscription.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which of the following is a legal responsibility in Canada?",
        "question_text_fr": "Laquelle des options suivantes est une responsabilite legale au Canada?",
        "options_en": ["Obeying the law", "Choosing judges directly", "Setting provincial borders personally", "Refusing to pay any taxes"],
        "options_fr": ["Respecter la loi", "Choisir directement les juges", "Fixer personnellement les frontieres provinciales", "Refuser de payer tout impot"],
        "correct_option_index": 0,
        "explanation_en": "Everyone in Canada is expected to obey the law.",
        "explanation_fr": "Toute personne au Canada doit respecter la loi.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which ocean is on Canada's west coast?",
        "question_text_fr": "Quel ocean se trouve sur la cote ouest du Canada?",
        "options_en": ["Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Southern Ocean"],
        "options_fr": ["L'ocean Atlantique", "L'ocean Pacifique", "L'ocean Indien", "L'ocean Austral"],
        "correct_option_index": 1,
        "explanation_en": "British Columbia is on Canada's Pacific coast.",
        "explanation_fr": "La Colombie-Britannique se trouve sur la cote pacifique du Canada.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What is the Canadian national anthem?",
        "question_text_fr": "Quel est l'hymne national du Canada?",
        "options_en": ["O Canada", "God Save the King", "The Maple Leaf Forever", "The Canadian Song"],
        "options_fr": ["O Canada", "Dieu sauve le roi", "The Maple Leaf Forever", "La chanson canadienne"],
        "correct_option_index": 0,
        "explanation_en": "O Canada is the national anthem.",
        "explanation_fr": "O Canada est l'hymne national.",
    },
    {
        "section": "government",
        "question_text_en": "Which level of government is usually responsible for schools and education?",
        "question_text_fr": "Quel ordre de gouvernement est generalement responsable des ecoles et de l'education?",
        "options_en": ["Provincial or territorial", "Only municipal", "Only federal", "Only the courts"],
        "options_fr": ["Provincial ou territorial", "Seulement municipal", "Seulement federal", "Seulement les tribunaux"],
        "correct_option_index": 0,
        "explanation_en": "Education is mainly a provincial and territorial responsibility.",
        "explanation_fr": "L'education releve principalement des provinces et des territoires.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Why is voting considered important in Canada?",
        "question_text_fr": "Pourquoi le vote est-il considere important au Canada?",
        "options_en": ["It lets citizens help choose representatives", "It replaces paying taxes", "It appoints every judge", "It changes the Constitution every time"],
        "options_fr": ["Il permet aux citoyens de contribuer au choix des representants", "Il remplace le paiement des impots", "Il nomme tous les juges", "Il modifie la Constitution a chaque fois"],
        "correct_option_index": 0,
        "explanation_en": "Voting is a central way citizens participate in democratic government.",
        "explanation_fr": "Le vote est une facon essentielle pour les citoyens de participer au gouvernement democratique.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which province is known for having a large French-speaking population?",
        "question_text_fr": "Quelle province est connue pour sa grande population francophone?",
        "options_en": ["Quebec", "Alberta", "Manitoba", "British Columbia"],
        "options_fr": ["Le Quebec", "L'Alberta", "Le Manitoba", "La Colombie-Britannique"],
        "correct_option_index": 0,
        "explanation_en": "Quebec has Canada's largest French-speaking population.",
        "explanation_fr": "Le Quebec compte la plus grande population francophone du Canada.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What does Confederation refer to in Canadian history?",
        "question_text_fr": "A quoi renvoie la Confederation dans l'histoire canadienne?",
        "options_en": ["The union that formed Canada in 1867", "The first municipal election", "The creation of the Supreme Court only", "The start of the fur trade only"],
        "options_fr": ["L'union qui a forme le Canada en 1867", "La premiere election municipale", "La creation de la Cour supreme seulement", "Le debut de la traite des fourrures seulement"],
        "correct_option_index": 0,
        "explanation_en": "Confederation refers to the political union that created Canada in 1867.",
        "explanation_fr": "La Confederation designe l'union politique qui a cree le Canada en 1867.",
    },
    {
        "section": "government",
        "question_text_en": "Who is usually the leader of the federal government?",
        "question_text_fr": "Qui dirige habituellement le gouvernement federal?",
        "options_en": ["The Prime Minister", "A provincial mayor", "The Chief Electoral Officer", "A senator from each province"],
        "options_fr": ["Le premier ministre", "Un maire provincial", "Le directeur general des elections", "Un senateur de chaque province"],
        "correct_option_index": 0,
        "explanation_en": "The Prime Minister is usually the leader of the party with the most seats in the House of Commons.",
        "explanation_fr": "Le premier ministre est habituellement le chef du parti qui detient le plus de sieges a la Chambre des communes.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "Which province is on Canada's Pacific coast?",
        "question_text_fr": "Quelle province se trouve sur la cote pacifique du Canada?",
        "options_en": ["Nova Scotia", "British Columbia", "Quebec", "New Brunswick"],
        "options_fr": ["La Nouvelle-Ecosse", "La Colombie-Britannique", "Le Quebec", "Le Nouveau-Brunswick"],
        "correct_option_index": 1,
        "explanation_en": "British Columbia is Canada's Pacific coast province.",
        "explanation_fr": "La Colombie-Britannique est la province canadienne de la cote pacifique.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which freedom allows Canadians to practise their religion peacefully?",
        "question_text_fr": "Quelle liberte permet aux Canadiens de pratiquer leur religion paisiblement?",
        "options_en": ["Freedom of religion", "Freedom from all rules", "Freedom to avoid elections", "Freedom to appoint officials"],
        "options_fr": ["La liberte de religion", "La liberte de toutes les regles", "La liberte d'eviter les elections", "La liberte de nommer les responsables"],
        "correct_option_index": 0,
        "explanation_en": "Freedom of religion is one of Canada's fundamental freedoms.",
        "explanation_fr": "La liberte de religion est l'une des libertes fondamentales du Canada.",
    },
]

QUESTION_BANK = SAMPLE_QUESTIONS + ADDITIONAL_SAMPLE_QUESTIONS


LANGUAGE_PROMPTS = {
    "en": [
        "Introduce yourself and explain why you want to become a Canadian citizen.",
        "Describe one responsibility of citizenship in your own words.",
        "Explain a recent community activity you joined or would like to join.",
    ],
    "fr": [
        "Présentez-vous et expliquez pourquoi vous voulez devenir citoyen canadien.",
        "Décrivez une responsabilité de la citoyenneté avec vos propres mots.",
        "Expliquez une activité communautaire récente ou une activité que vous aimeriez faire.",
    ],
}


def normalize_language(language: str | None) -> str:
    return "fr" if str(language or "").lower().startswith("fr") else "en"


FRENCH_TEXT_REPLACEMENTS = {
    "Ã©": "\u00e9",
    "Ã¨": "\u00e8",
    "Ãª": "\u00ea",
    "Ã´": "\u00f4",
    "Ã‰": "\u00c9",
    "Ã ": "\u00e0",
    "Ã§": "\u00e7",
    "citoyennete": "citoyennet\u00e9",
    "responsabilites": "responsabilit\u00e9s",
    "responsabilite": "responsabilit\u00e9",
    "democratiques": "d\u00e9mocratiques",
    "Revisez": "R\u00e9visez",
    "federalisme": "f\u00e9d\u00e9ralisme",
    "federale": "f\u00e9d\u00e9rale",
    "federales": "f\u00e9d\u00e9rales",
    "federal": "f\u00e9d\u00e9ral",
    "representants": "repr\u00e9sentants",
    "elections": "\u00e9lections",
    "Geographie": "G\u00e9ographie",
    "economie": "\u00e9conomie",
    "Etudiez": "\u00c9tudiez",
    "regions": "r\u00e9gions",
    "identite": "identit\u00e9",
    "convoque": "convoqu\u00e9",
    "general": "g\u00e9n\u00e9ral",
    "Rediger": "R\u00e9diger",
    "senateurs": "s\u00e9nateurs",
    "etre": "\u00eatre",
    "convoques": "convoqu\u00e9s",
    "jures": "jur\u00e9s",
    "systeme": "syst\u00e8me",
    "election": "\u00e9lection",
    "electeurs": "\u00e9lecteurs",
    "depute": "d\u00e9put\u00e9",
    "supreme": "supr\u00eame",
    "erable": "\u00e9rable",
    "Senat": "S\u00e9nat",
    "protege": "prot\u00e9g\u00e9",
    "liberte": "libert\u00e9",
    "protegee": "prot\u00e9g\u00e9e",
    "eviter": "\u00e9viter",
    "impots": "imp\u00f4ts",
    "prive": "priv\u00e9",
    "Presentez": "Pr\u00e9sentez",
    "Decrivez": "D\u00e9crivez",
    "activite": "activit\u00e9",
    "recente": "r\u00e9cente",
    "inspire": "inspir\u00e9",
    "themes": "th\u00e8mes",
    "etude": "\u00e9tude",
    "Decouvrir": "D\u00e9couvrir",
    "educatif": "\u00e9ducatif",
    "resultats": "r\u00e9sultats",
    "resultat": "r\u00e9sultat",
    "reponses": "r\u00e9ponses",
    "reponse": "r\u00e9ponse",
    "francais": "fran\u00e7ais",
    "Francais": "Fran\u00e7ais",
    "Preparez": "Pr\u00e9parez",
    "Repondez": "R\u00e9pondez",
    "Reussi": "R\u00e9ussi",
    "details": "d\u00e9tails",
    "reessayez": "r\u00e9essayez",
    "recentes": "r\u00e9centes",
    "enregistree": "enregistr\u00e9e",
    "envoye": "envoy\u00e9",
    "ete": "\u00e9t\u00e9",
    "protege": "prot\u00e8ge",
    "libertes": "libert\u00e9s",
    "sante": "sant\u00e9",
    "batiment": "b\u00e2timent",
    "role": "r\u00f4le",
    "armees": "arm\u00e9es",
    "Peres": "P\u00e8res",
    "Confederation": "Conf\u00e9d\u00e9ration",
    "associee": "associ\u00e9e",
    "reglement": "r\u00e8glement",
    "apres": "apr\u00e8s",
    "electorale": "\u00e9lectorale",
    "electorales": "\u00e9lectorales",
    "peuplee": "peupl\u00e9e",
    "Etat": "\u00c9tat",
    "ceremonie": "c\u00e9r\u00e9monie",
    "enonce": "\u00e9nonc\u00e9",
    "egalite": "\u00e9galit\u00e9",
    "elus": "\u00e9lus",
    "benefice": "b\u00e9n\u00e9fice",
    "regles": "r\u00e8gles",
    "ministere": "minist\u00e8re",
    "siege": "si\u00e8ge",
    "frontieres": "fronti\u00e8res",
    "ocean": "oc\u00e9an",
    "cote": "c\u00f4te",
    "generalement": "g\u00e9n\u00e9ralement",
    "ecoles": "\u00e9coles",
    "education": "\u00e9ducation",
    "considere": "consid\u00e9r\u00e9",
    "facon": "fa\u00e7on",
    "Quebec": "Qu\u00e9bec",
    "cree": "cr\u00e9\u00e9",
    "forme": "form\u00e9",
    "premiere": "premi\u00e8re",
    "detient": "d\u00e9tient",
    "sieges": "si\u00e8ges",
    "Nouvelle-Ecosse": "Nouvelle-\u00c9cosse",
}


def normalize_french_text(value):
    if isinstance(value, list):
        return [normalize_french_text(item) for item in value]
    if not isinstance(value, str):
        return value

    normalized = value
    for source, replacement in FRENCH_TEXT_REPLACEMENTS.items():
        normalized = normalized.replace(source, replacement)
    return normalized


def ensure_seed_questions(db: Session) -> None:
    for item in QUESTION_BANK:
        existing = (
            db.query(CitizenshipQuestion)
            .filter(CitizenshipQuestion.question_text_en == item["question_text_en"])
            .first()
        )

        if existing:
            existing.question_text_fr = normalize_french_text(item["question_text_fr"])
            existing.options_fr = normalize_french_text(item["options_fr"])
            existing.explanation_fr = normalize_french_text(item["explanation_fr"])
            existing.section = item["section"]
            existing.correct_option_index = item["correct_option_index"]
            existing.source_note = "Practice material inspired by official citizenship study themes."
            continue

        db.add(
            CitizenshipQuestion(
                **{
                    **item,
                    "question_text_fr": normalize_french_text(item["question_text_fr"]),
                    "options_fr": normalize_french_text(item["options_fr"]),
                    "explanation_fr": normalize_french_text(item["explanation_fr"]),
                },
                difficulty="standard",
                source_note="Practice material inspired by official citizenship study themes.",
            )
        )
    db.commit()


def shuffled_option_order(question: CitizenshipQuestion) -> list[int]:
    order = list(range(len(question.options_en or [])))
    random.shuffle(order)
    return order


def normalize_option_order(question: CitizenshipQuestion, option_order: list[int] | None) -> list[int]:
    option_count = len(question.options_en or [])
    fallback = list(range(option_count))
    if not option_order or len(option_order) != option_count:
        return fallback

    cleaned = []
    for item in option_order:
        try:
            cleaned.append(int(item))
        except (TypeError, ValueError):
            return fallback
    return cleaned if sorted(cleaned) == fallback else fallback


def serialize_question(
    question: CitizenshipQuestion,
    language: str,
    option_order: list[int] | None = None,
) -> dict:
    lang = normalize_language(language)
    options = normalize_french_text(question.options_fr) if lang == "fr" and question.options_fr else question.options_en
    order = normalize_option_order(question, option_order)
    return {
        "id": question.id,
        "question_text": normalize_french_text(question.question_text_fr) if lang == "fr" and question.question_text_fr else question.question_text_en,
        "options": [options[index] for index in order],
        "option_order": order,
        "section": question.section,
        "difficulty": question.difficulty,
        "source_note": (
            "Contenu de pratique inspiré des thèmes officiels d'étude de la citoyenneté."
            if lang == "fr"
            else question.source_note
        ),
    }


def question_explanation(question: CitizenshipQuestion, language: str) -> str:
    lang = normalize_language(language)
    return normalize_french_text(question.explanation_fr) if lang == "fr" and question.explanation_fr else question.explanation_en


def compute_progress(db: Session, user_id: int) -> dict:
    attempts = (
        db.query(CitizenshipQuizAttempt)
        .filter(CitizenshipQuizAttempt.user_id == user_id)
        .order_by(CitizenshipQuizAttempt.created_at.desc())
        .all()
    )
    answers = (
        db.query(CitizenshipAnswer, CitizenshipQuestion)
        .join(CitizenshipQuestion, CitizenshipQuestion.id == CitizenshipAnswer.question_id)
        .join(CitizenshipQuizAttempt, CitizenshipQuizAttempt.id == CitizenshipAnswer.attempt_id)
        .filter(CitizenshipQuizAttempt.user_id == user_id)
        .all()
    )

    section_stats: dict[str, dict] = {}
    for answer, question in answers:
        stats = section_stats.setdefault(question.section, {"section": question.section, "total": 0, "correct": 0})
        stats["total"] += 1
        if answer.is_correct:
            stats["correct"] += 1

    weak_sections = []
    for stats in section_stats.values():
        accuracy = round((stats["correct"] / stats["total"]) * 100) if stats["total"] else 0
        if accuracy < 70:
            weak_sections.append({**stats, "accuracy": accuracy})

    language_sessions_count = (
        db.query(func.count(LanguagePracticeSession.id))
        .filter(LanguagePracticeSession.user_id == user_id)
        .scalar()
        or 0
    )

    scores = [attempt.score_percent for attempt in attempts]
    return {
        "attempts_count": len(attempts),
        "best_score_percent": max(scores) if scores else 0,
        "average_score_percent": round(sum(scores) / len(scores)) if scores else 0,
        "latest_score_percent": scores[0] if scores else None,
        "questions_answered": len(answers),
        "weak_sections": weak_sections[:4],
        "language_sessions_count": language_sessions_count,
    }
