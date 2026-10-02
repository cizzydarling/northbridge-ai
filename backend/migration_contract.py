"""Frozen individual-launch DDL contract; independent of mutable application models.

Used by the repaired disclosure revision and the forward reconciliation revision.
Do not change this contract for future features: introduce another revision instead.
"""
import sqlalchemy as sa


def user_table():
    table = sa.Table(
        "users", sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String, nullable=False),
        sa.Column("password", sa.String, nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("plan", sa.String, nullable=False),
        sa.Column("token_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("subscription_status", sa.String),
        sa.Column("subscription_cancel_at_period_end", sa.Boolean),
        sa.Column("subscription_current_period_end", sa.DateTime(timezone=True)),
        sa.Column("email_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("email_confirmation_token_hash", sa.String(128)),
        sa.Column("password_reset_token_hash", sa.String(128)),
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True)),
        sa.Column("stripe_customer_id", sa.String, unique=True),
        sa.Column("stripe_subscription_id", sa.String, unique=True),
    )
    for prefix in ("cancellation_email", "billing_issue_email", "onboarding_email", "email_confirmation", "password_reset"):
        table.append_column(sa.Column(prefix + "_sent_at", sa.DateTime(timezone=True)))
        table.append_column(sa.Column(prefix + "_status", sa.String))
        table.append_column(sa.Column(prefix + "_error", sa.Text))
    sa.Index("ix_users_id", table.c.id)
    sa.Index("ix_users_email", table.c.email, unique=True)
    return table


def disclosure_table():
    metadata = sa.MetaData()
    table = sa.Table(
        "disclosure_acceptances", metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id")),
        sa.Column("matter_id", sa.Integer, sa.ForeignKey("matters.id")),
        sa.Column("disclosure_type", sa.String(100), nullable=False),
        sa.Column("disclosure_version", sa.String(50), nullable=False),
        sa.Column("accepted_text_snapshot", sa.Text, nullable=False),
        sa.Column("accepted_by_email_snapshot", sa.String(255)),
        sa.Column("acceptance_scope", sa.String(50), nullable=False, server_default="global"),
        sa.Column("ip_address", sa.String(64)),
        sa.Column("user_agent", sa.Text),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    for name in ("id", "user_id", "client_id", "matter_id", "disclosure_type", "disclosure_version", "accepted_at"):
        sa.Index(f"ix_disclosure_acceptances_{name}", table.c[name])
    return table


def generated_table():
    table = sa.Table(
        "generated_documents", sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("document_type", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("language", sa.String, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("tone", sa.String),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    for name in ("id", "user_id"):
        sa.Index(f"ix_generated_documents_{name}", table.c[name])
    return table


def profile_table():
    table = sa.Table(
        "profiles", sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, unique=True),
    )
    for name in ("first_name", "last_name", "nationality", "current_country", "current_city",
                 "phone_number", "date_of_birth", "marital_status", "preferred_language",
                 "education", "occupation", "noc_code", "preferred_province"):
        table.append_column(sa.Column(name, sa.String))
    for name in ("age", "language_score", "experience_years", "english_language_score", "french_language_score"):
        table.append_column(sa.Column(name, sa.Integer))
    for name in ("has_job_offer", "has_canadian_experience", "studied_in_canada"):
        table.append_column(sa.Column(name, sa.Boolean))
    for name in ("job_description", "job_duties"):
        table.append_column(sa.Column(name, sa.Text))
    sa.Index("ix_profiles_id", table.c.id)
    return table


def _default(value):
    if value is None:
        return None
    normalized = str(value).replace("::character varying", "").replace("::text", "").strip()
    # PostgreSQL normalizes the integer default supplied as the SQLAlchemy string "0".
    return "0" if normalized in {"'0'", "'0'::integer", "0::integer"} else normalized


def validate_table(bind, expected, *, optional_columns=()):
    """Reject drift rather than adopting a same-named but incompatible object."""
    inspector = sa.inspect(bind)
    name = expected.name
    if not inspector.has_table(name):
        raise RuntimeError(f"Unsupported schema: missing {name}")
    actual = {column["name"]: column for column in inspector.get_columns(name)}
    required = set(expected.c.keys()) - set(optional_columns)
    if not required <= actual.keys() or actual.keys() - set(expected.c.keys()):
        raise RuntimeError(f"Unsupported schema: {name} columns")
    for column_name, found in actual.items():
        wanted = expected.c[column_name]
        if (str(found["type"].compile(dialect=bind.dialect)) != str(wanted.type.compile(dialect=bind.dialect))
                or found["nullable"] != wanted.nullable):
            raise RuntimeError(f"Unsupported schema: {name}.{column_name} type/nullability")
        if column_name == "id":
            if not str(found.get("default") or "").startswith("nextval(") or found.get("identity"):
                raise RuntimeError(f"Unsupported schema: {name}.id sequence default")
        else:
            wanted_default = wanted.server_default.arg if wanted.server_default is not None else None
            # SQLAlchemy string defaults are quoted by the PostgreSQL DDL compiler.
            if isinstance(wanted_default, str):
                wanted_default = repr(wanted_default)
            if _default(found.get("default")) != _default(wanted_default):
                raise RuntimeError(f"Unsupported schema: {name}.{column_name} default")
    if inspector.get_pk_constraint(name)["constrained_columns"] != ["id"]:
        raise RuntimeError(f"Unsupported schema: {name} primary key")
    wanted_fks = {(tuple(fk.parent.name for fk in constraint.elements),
                   tuple(fk.target_fullname for fk in constraint.elements))
                  for constraint in expected.foreign_key_constraints}
    actual_fks = set()
    for fk in inspector.get_foreign_keys(name):
        if fk.get("options") or fk.get("referred_schema") not in (None, "public"):
            raise RuntimeError(f"Unsupported schema: {name} foreign key options")
        actual_fks.add((tuple(fk["constrained_columns"]),
                        tuple(f'{fk["referred_table"]}.{col}' for col in fk["referred_columns"])))
    if actual_fks != wanted_fks:
        raise RuntimeError(f"Unsupported schema: {name} foreign keys")
    wanted_unique = {tuple(c.name for c in constraint.columns) for constraint in expected.constraints
                     if isinstance(constraint, sa.UniqueConstraint)}
    if {tuple(c["column_names"]) for c in inspector.get_unique_constraints(name)} != wanted_unique:
        raise RuntimeError(f"Unsupported schema: {name} uniqueness")
    if inspector.get_check_constraints(name):
        raise RuntimeError(f"Unsupported schema: {name} unexpected checks")
    indexes = inspector.get_indexes(name)
    actual_indexes = {(i["name"], tuple(i["column_names"]), bool(i["unique"]))
                      for i in indexes if not i.get("duplicates_constraint")}
    wanted_indexes = {(i.name, tuple(c.name for c in i.columns), bool(i.unique)) for i in expected.indexes}
    if actual_indexes != wanted_indexes or any(
        any(i.get("dialect_options", {}).values()) for i in indexes
    ):
        raise RuntimeError(f"Unsupported schema: {name} indexes")
    invalid = bind.execute(sa.text("""
        SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass(:name) AND NOT convalidated)
            OR EXISTS (SELECT 1 FROM pg_index WHERE indrelid = to_regclass(:name)
                       AND (NOT indisvalid OR NOT indisready))
    """), {"name": name}).scalar()
    if invalid:
        raise RuntimeError(f"Unsupported schema: {name} invalid constraints/indexes")


def create_table(op, table):
    # Copy explicit columns/constraints without importing current ORM metadata.
    columns = [sa.Column(c.name, c.type, nullable=c.nullable,
                         primary_key=c.primary_key, server_default=c.server_default)
               for c in table.columns]
    foreign_keys = [sa.ForeignKeyConstraint(
        [fk.parent.name for fk in constraint.elements],
        [fk.target_fullname for fk in constraint.elements])
        for constraint in table.foreign_key_constraints]
    op.create_table(table.name, *columns, *foreign_keys)
    for index in table.indexes:
        op.create_index(index.name, table.name, [column.name for column in index.columns], unique=index.unique)
