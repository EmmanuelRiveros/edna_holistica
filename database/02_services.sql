-- ============================================================
-- 02_services.sql
-- Tablas: services, therapist_services
-- ============================================================
-- Decisiones de diseño:
--   • CHECK en duration_minutes > 0 y base_price >= 0:
--     precio 0 es válido (sesiones de cortesía).
--   • Pivote therapist_services con UNIQUE compuesto:
--     un terapeuta no puede estar asignado dos veces
--     al mismo servicio.
--   • CASCADE en ambas FK de la pivote: si se elimina
--     el terapeuta o el servicio, la relación desaparece.
-- ============================================================

-- -----------------------------------------------------------
-- TABLA: services
-- Catálogo de servicios terapéuticos individuales.
-- -----------------------------------------------------------
CREATE TABLE services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150)    NOT NULL,
    description         TEXT,
    benefits            TEXT,
    duration_minutes    INTEGER         NOT NULL
                            CHECK (duration_minutes > 0),
    base_price          DECIMAL(10, 2)  NOT NULL
                            CHECK (base_price >= 0),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- Índice para búsquedas y listados por nombre.
CREATE INDEX idx_services_name
    ON services (name);

-- -----------------------------------------------------------
-- TABLA: therapist_services (Pivote N:M)
-- Asocia terapeutas con los servicios que ofrecen.
-- -----------------------------------------------------------
CREATE TABLE therapist_services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id    UUID            NOT NULL
                        REFERENCES users (id) ON DELETE CASCADE,
    service_id      UUID            NOT NULL
                        REFERENCES services (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Un terapeuta no puede estar asociado más de una vez al mismo servicio.
    CONSTRAINT uq_therapist_service
        UNIQUE (therapist_id, service_id)
);
