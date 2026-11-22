-- The application compares login identifiers without regard to case. Enforce
-- the same rule in PostgreSQL so concurrent writers cannot create case variants.
CREATE UNIQUE INDEX "User_loginIdentifier_lower_key"
    ON "User" (lower("loginIdentifier"));
