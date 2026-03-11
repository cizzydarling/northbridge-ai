PATHWAYS = [
    {
        "id": "express_entry_fsw",
        "name": "Express Entry - Federal Skilled Worker",
        "category": "Express Entry",
        "province": "Federal",
        "min_crs": 470,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 7,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "target_occupations": [],
        "target_noc_codes": [],
        "occupation_groups": ["general_skilled"],
        "description": "For skilled workers with strong language, education, and work experience.",
        "tips": [
            "Improve language scores to increase CRS.",
            "Keep Express Entry profile updated.",
            "Consider provincial nomination for +600 points."
        ]
    },
    {
        "id": "express_entry_cec",
        "name": "Express Entry - Canadian Experience Class",
        "category": "Express Entry",
        "province": "Federal",
        "min_crs": 430,
        "requires_job_offer": False,
        "requires_canadian_experience": True,
        "requires_study_in_canada": False,
        "language_min": 7,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "description": "For candidates with qualifying Canadian work experience.",
        "tips": [
            "Canadian work experience is a major advantage.",
            "Maintain valid work documents.",
            "Improve language score to raise ranking."
        ]
    },
    {
        "id": "ontario_hcp",
        "name": "Ontario Immigrant Nominee Program - Human Capital Priorities",
        "category": "PNP",
        "province": "Ontario",
        "min_crs": 400,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 7,
        "experience_min": 1,
        "education_levels": ["bachelor", "master", "phd"],
        "description": "Ontario pathway for skilled candidates in the Express Entry pool.",
        "tips": [
            "A stronger CRS improves selection chances.",
            "Ontario may target specific occupations.",
            "A provincial nomination can add 600 points."
        ]
    },
    {
        "id": "ontario_tech_draw",
        "name": "Ontario Immigrant Nominee Program - Tech Draw",
        "category": "PNP",
        "province": "Ontario",
        "min_crs": 400,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 7,
        "experience_min": 1,
        "education_levels": ["bachelor", "master", "phd", "college"],
        "target_occupations": [
            "software engineer",
            "software developer",
            "computer programmer",
            "web developer",
            "data scientist",
            "data analyst",
            "devops engineer",
            "cloud engineer"
        ],
        "target_noc_codes": ["21231", "21232", "21234", "21223", "21211"],
        "occupation_groups": ["tech"],
        "description": "Ontario pathway targeting selected tech occupations in the Express Entry pool.",
        "tips": [
            "Tech occupations may receive targeted invitations.",
            "Keep NOC information accurate.",
            "Higher language scores improve competitiveness."
        ]
    },
    {
        "id": "bc_pnp_tech",
        "name": "British Columbia PNP - Tech",
        "category": "PNP",
        "province": "British Columbia",
        "min_crs": 0,
        "requires_job_offer": True,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 5,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "target_occupations": [
            "software engineer",
            "software developer",
            "data scientist",
            "cybersecurity analyst",
            "systems analyst",
            "network engineer"
        ],
        "target_noc_codes": ["21231", "21232", "21220", "21211", "22220"],
        "occupation_groups": ["tech"],
        "description": "BC tech-oriented pathway often linked to a qualifying job offer.",
        "tips": [
            "A BC tech job offer can be decisive.",
            "Check whether your occupation is on the targeted list.",
            "Employer support is important."
        ]
    },
    {
        "id": "healthcare_targeted_pathway",
        "name": "Healthcare Targeted Provincial Pathway",
        "category": "PNP",
        "province": "Multiple Provinces",
        "min_crs": 350,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 6,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "target_occupations": [
            "nurse",
            "registered nurse",
            "licensed practical nurse",
            "physician",
            "doctor",
            "pharmacist",
            "medical laboratory technologist"
        ],
        "target_noc_codes": ["31301", "32101", "31102", "31100", "32120"],
        "occupation_groups": ["healthcare"],
        "description": "Represents provincial pathways that often prioritize healthcare occupations.",
        "tips": [
            "Healthcare occupations are frequently prioritized.",
            "Licensing requirements may apply.",
            "Provincial targeting can change by occupation."
        ]
    },
    {
        "id": "skilled_trades_targeted_pathway",
        "name": "Skilled Trades Targeted Pathway",
        "category": "PNP",
        "province": "Multiple Provinces",
        "min_crs": 300,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 5,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "target_occupations": [
            "electrician",
            "welder",
            "plumber",
            "carpenter",
            "industrial mechanic"
        ],
        "target_noc_codes": ["72200", "72106", "72300", "72310", "72400"],
        "occupation_groups": ["trades"],
        "description": "Represents pathways that often favour skilled trades occupations.",
        "tips": [
            "Trade certification may be required.",
            "Job offers can improve competitiveness.",
            "Occupation-specific demand matters."
        ],
    },
    {
        "id": "atlantic_immigration_program",
        "name": "Atlantic Immigration Program",
        "category": "Regional",
        "province": "Atlantic Canada",
        "min_crs": 0,
        "requires_job_offer": True,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 4,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "description": "Regional pathway tied to designated employers in Atlantic provinces.",
        "tips": [
            "A designated employer is usually required.",
            "This pathway can be more accessible than Express Entry.",
            "Target Atlantic employers actively hiring."
        ]
    },
    {
        "id": "saskatchewan_occupations_in_demand",
        "name": "Saskatchewan PNP - Occupations In-Demand",
        "category": "PNP",
        "province": "Saskatchewan",
        "min_crs": 0,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 4,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "description": "For candidates in eligible occupations without a job offer.",
        "tips": [
            "Occupation eligibility matters a lot.",
            "Check whether your NOC is targeted.",
            "Language and education still improve competitiveness."
        ]
    },
    {
        "id": "manitoba_skilled_worker",
        "name": "Manitoba PNP - Skilled Worker",
        "category": "PNP",
        "province": "Manitoba",
        "min_crs": 0,
        "requires_job_offer": False,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 5,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "description": "For workers with provincial ties, demand occupation, or other eligibility factors.",
        "tips": [
            "Provincial connections improve chances.",
            "Work history and occupation matter.",
            "Language improvement strengthens profile."
        ]
    },
    {
        "id": "alberta_opportunity_stream",
        "name": "Alberta Opportunity Stream",
        "category": "PNP",
        "province": "Alberta",
        "min_crs": 0,
        "requires_job_offer": True,
        "requires_canadian_experience": False,
        "requires_study_in_canada": False,
        "language_min": 4,
        "experience_min": 1,
        "education_levels": ["college", "bachelor", "master", "phd"],
        "description": "Provincial pathway often linked to Alberta employment.",
        "tips": [
            "An Alberta job offer is a major factor.",
            "Check occupation and permit conditions.",
            "Target employer-supported pathways."
        ]
    }
]