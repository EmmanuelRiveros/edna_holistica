-- ============================================================
-- 01_users.sql
-- Tablas: users, client_profiles
-- ============================================================
-- Decisiones de diseño:
--   • UUID como PK: evita colisiones en sistemas distribuidos
--     y oculta el conteo de registros (seguridad).
--   • Índice parcial en email: permite reutilizar emails de
--     cuentas soft-deleted sin violar unicidad.
--   • client_profiles separado de users: no todos los usuarios
--     necesitan datos clínicos (admin/terapeuta no lo usan).
--   • UNIQUE en user_id garantiza relación 1:1.
-- ============================================================

-- Extensión para gen_random_uuid() (PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- TABLA: users
-- Autenticación y datos de identidad para todos los roles.
-- -----------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name      VARCHAR(100)    NOT NULL,
    last_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(20)     NOT NULL
                        CHECK (role IN ('admin', 'therapist', 'client')),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Índice parcial: unicidad de email solo entre registros activos (soft-delete).
-- Permite que un usuario se dé de baja y otro registre el mismo email.
CREATE UNIQUE INDEX idx_users_email_active
    ON users (email)
    WHERE deleted_at IS NULL;

-- Índice para filtrar por rol (ej: listar todos los terapeutas).
CREATE INDEX idx_users_role
    ON users (role);

-- -----------------------------------------------------------
-- TABLA: client_profiles
-- Perfil extendido exclusivo para usuarios con rol 'client'.
-- Relación 1:1 con users (UNIQUE en user_id).
-- -----------------------------------------------------------
CREATE TABLE client_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL UNIQUE
                            REFERENCES users (id) ON DELETE CASCADE,
    date_of_birth       DATE,
    allergies           TEXT,
    medical_conditions  TEXT,
    photo_url           VARCHAR(500),
    preferred_contact   VARCHAR(10)     NOT NULL DEFAULT 'email'
                            CHECK (preferred_contact IN ('email', 'sms', 'both')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- No se requieren índices adicionales: user_id ya tiene
-- un índice implícito por la restricción UNIQUE.
