-- ============================================================
-- 03_workshops.sql
-- Tablas: workshops, workshop_instructors
-- ============================================================
-- Decisiones de diseño:
--   • CHECK ends_at > starts_at: evita eventos inválidos.
--   • image_urls como TEXT[]: tipo nativo de PostgreSQL que
--     evita una tabla adicional de imágenes. Se consulta con
--     unnest() y se inserta con ARRAY['url1','url2'].
--   • status como VARCHAR con CHECK: más legible que un ENUM
--     y no requiere ALTER TYPE para agregar valores.
--   • workshop_instructors permite co-facilitadores:
--     varios instructores para un mismo taller.
-- ============================================================

-- -----------------------------------------------------------
-- TABLA: workshops
-- Talleres y eventos grupales (presenciales, virtuales o híbridos).
-- -----------------------------------------------------------
CREATE TABLE workshops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200)    NOT NULL,
    description     TEXT,
    type            VARCHAR(15)     NOT NULL
                        CHECK (type IN ('presencial', 'virtual', 'hibrido')),
    starts_at       TIMESTAMPTZ     NOT NULL,
    ends_at         TIMESTAMPTZ     NOT NULL,
    max_capacity    INTEGER         NOT NULL
                        CHECK (max_capacity > 0),
    price           DECIMAL(10, 2)  NOT NULL
                        CHECK (price >= 0),
    materials       TEXT,
    image_urls      TEXT[],
    status          VARCHAR(15)     NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'cancelled', 'finished')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- Un taller no puede terminar antes de empezar.
    CONSTRAINT chk_workshop_dates
        CHECK (ends_at > starts_at)
);

-- Índice para consultas por rango de fechas (ej: "talleres de esta semana").
CREATE INDEX idx_workshops_starts_at
    ON workshops (starts_at);

-- Índice para filtrar por estado (ej: solo publicados en el portal público).
CREATE INDEX idx_workshops_status
    ON workshops (status);

-- -----------------------------------------------------------
-- TABLA: workshop_instructors (Pivote N:M)
-- Permite asignar múltiples instructores/terapeutas a un taller.
-- -----------------------------------------------------------
CREATE TABLE workshop_instructors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id     UUID            NOT NULL
                        REFERENCES workshops (id) ON DELETE CASCADE,
    instructor_id   UUID            NOT NULL
                        REFERENCES users (id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Un instructor no puede estar asignado más de una vez al mismo taller.
    CONSTRAINT uq_workshop_instructor
        UNIQUE (workshop_id, instructor_id)
);
