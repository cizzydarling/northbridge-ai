"""Household V1: frozen forward DDL, preserves existing individual records.

Revision ID: fc9a4123b075
Revises: eb8f3012a964
"""
from alembic import op
revision = "fc9a4123b075"
down_revision = "eb8f3012a964"
branch_labels = None
depends_on = None

DDL = [
    """CREATE TABLE households (
	id SERIAL NOT NULL,
	owner_user_id INTEGER NOT NULL,
	name VARCHAR(120) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_household_owner_pair UNIQUE (id, owner_user_id),
	UNIQUE (owner_user_id),
	FOREIGN KEY(owner_user_id) REFERENCES users (id)
)""",
    """CREATE TABLE household_members (
	id SERIAL NOT NULL,
	household_id INTEGER NOT NULL,
	owner_user_id INTEGER,
	first_name VARCHAR(100),
	last_name VARCHAR(100),
	relationship_to_primary VARCHAR(30) NOT NULL,
	date_of_birth DATE,
	nationality VARCHAR(100),
	current_country VARCHAR(100),
	email VARCHAR(254),
	is_primary_applicant BOOLEAN NOT NULL,
	archived_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_member_household UNIQUE (id, household_id),
	CONSTRAINT uq_self_owner UNIQUE (id, household_id, owner_user_id),
	CONSTRAINT fk_self_household_owner FOREIGN KEY(household_id, owner_user_id) REFERENCES households (id, owner_user_id),
	CONSTRAINT ck_member_relationship CHECK (relationship_to_primary IN ('self','spouse','common_law_partner','child')),
	CONSTRAINT ck_member_self CHECK ((relationship_to_primary = 'self' AND owner_user_id IS NOT NULL AND is_primary_applicant AND archived_at IS NULL) OR (relationship_to_primary <> 'self' AND owner_user_id IS NULL AND NOT is_primary_applicant)),
	FOREIGN KEY(household_id) REFERENCES households (id)
)""",
    """CREATE INDEX ix_household_members_household_id ON household_members (household_id)""",
    """CREATE UNIQUE INDEX uq_household_partner ON household_members (household_id) WHERE relationship_to_primary IN ('spouse','common_law_partner') AND archived_at IS NULL""",
    """CREATE UNIQUE INDEX uq_household_self ON household_members (household_id) WHERE relationship_to_primary = 'self'""",
    """CREATE TABLE application_cases (
	id SERIAL NOT NULL,
	household_id INTEGER NOT NULL,
	owner_user_id INTEGER NOT NULL,
	primary_applicant_member_id INTEGER NOT NULL,
	application_type VARCHAR(40) NOT NULL,
	case_title VARCHAR(120),
	status VARCHAR(20) NOT NULL,
	is_active BOOLEAN NOT NULL,
	target_country VARCHAR(80) NOT NULL,
	target_province VARCHAR(80),
	pathway VARCHAR(120),
	family_size INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_case_household UNIQUE (id, household_id),
	CONSTRAINT uq_case_owner UNIQUE (id, owner_user_id),
	CONSTRAINT fk_case_household_owner FOREIGN KEY(household_id, owner_user_id) REFERENCES households (id, owner_user_id),
	CONSTRAINT fk_case_primary_self FOREIGN KEY(primary_applicant_member_id, household_id, owner_user_id) REFERENCES household_members (id, household_id, owner_user_id),
	CONSTRAINT ck_case_type CHECK (application_type IN ('permanent_residence','study_permit','work_permit','visitor_visa','spousal_sponsorship')),
	CONSTRAINT ck_case_status CHECK (status IN ('draft','in_progress','archived')),
	CONSTRAINT ck_active_not_archived CHECK (NOT is_active OR status <> 'archived'),
	CONSTRAINT ck_case_family_size CHECK (family_size >= 1)
)""",
    """CREATE INDEX ix_application_cases_household_id ON application_cases (household_id)""",
    """CREATE INDEX ix_application_cases_owner_user_id ON application_cases (owner_user_id)""",
    """CREATE UNIQUE INDEX uq_active_case ON application_cases (owner_user_id) WHERE is_active""",
    """CREATE TABLE application_case_members (
	application_case_id INTEGER NOT NULL,
	household_member_id INTEGER NOT NULL,
	household_id INTEGER NOT NULL,
	participation VARCHAR(20) NOT NULL,
	PRIMARY KEY (application_case_id, household_member_id),
	CONSTRAINT fk_participation_case FOREIGN KEY(application_case_id, household_id) REFERENCES application_cases (id, household_id),
	CONSTRAINT fk_participation_member FOREIGN KEY(household_member_id, household_id) REFERENCES household_members (id, household_id),
	CONSTRAINT ck_participation CHECK (participation IN ('accompanying','non_accompanying','unknown'))
)""",
    """CREATE INDEX ix_application_case_members_household_id ON application_case_members (household_id)""",
    """ALTER TABLE self_applications ADD COLUMN application_case_id INTEGER""",
    """CREATE INDEX ix_self_applications_application_case_id ON self_applications(application_case_id)""",
    """ALTER TABLE self_applications ADD CONSTRAINT fk_self_application_case_owner FOREIGN KEY(application_case_id,user_id) REFERENCES application_cases(id,owner_user_id)""",
    """CREATE FUNCTION nbai_check_household_self() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE hid integer;
BEGIN
  IF TG_TABLE_NAME = 'households' THEN hid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN hid := OLD.household_id;
  ELSE hid := NEW.household_id; END IF;
  IF EXISTS (SELECT 1 FROM households WHERE id=hid) AND
     (SELECT count(*) FROM household_members WHERE household_id=hid AND relationship_to_primary='self') <> 1 THEN
    RAISE EXCEPTION 'Household must have exactly one SELF member' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$""",
    """CREATE CONSTRAINT TRIGGER household_self_required AFTER INSERT OR UPDATE ON households DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nbai_check_household_self()""",
    """CREATE CONSTRAINT TRIGGER member_self_required AFTER INSERT OR UPDATE OR DELETE ON household_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nbai_check_household_self()""",
    """CREATE FUNCTION nbai_protect_self() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.relationship_to_primary = 'self' THEN
   IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'SELF cannot be deleted' USING ERRCODE='23514'; END IF;
   IF NEW.id <> OLD.id OR NEW.household_id <> OLD.household_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.relationship_to_primary <> 'self' THEN
     RAISE EXCEPTION 'SELF identity is immutable' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$""",
    """CREATE TRIGGER protect_self BEFORE UPDATE OR DELETE ON household_members FOR EACH ROW EXECUTE FUNCTION nbai_protect_self()""",
]

def upgrade():
    for statement in DDL:
        op.execute(statement)

def downgrade():
    raise RuntimeError("Household V1 contains user data. Restore a verified backup; destructive downgrade is not supported.")
