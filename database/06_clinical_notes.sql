-- ============================================================
-- 06_clinical_notes.sql
-- Tabla: clinical_notes
-- ============================================================
-- Decisiones de diseño:
--   • client_id NOT NULL + CASCADE: la nota siempre
--     pertenece a un paciente; si el paciente se borra
--     (hard delete), las notas se eliminan con él.
--   • therapist_id permite NULL + SET NULL: si el terapeuta
--     deja la plataforma, la nota persiste sin autor.
--     El borrado lógico se gestiona desde la aplicación.
--   • reservation_id permite NULL + SET NULL: las notas
--     de evolución general no están ligadas a una sesión
--     específica. Si la reserva se elimina, la nota persiste.
--   • Visibilidad (terapeuta creador + admin) se controla
--     en la capa de aplicación/API, no en la BD.
-- ============================================================

-- -----------------------------------------------------------
-- TABLA: clinical_notes
-- Notas clínicas privadas del terapeuta sobre un cliente.
-- -----------------------------------------------------------
CREATE TABLE clinical_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID            NOT NULL
                        REFERENCES users (id) ON DELETE CASCADE,
    therapist_id    UUID
                        REFERENCES users (id) ON DELETE SET NULL,
    reservation_id  UUID
                        REFERENCES reservations (id) ON DELETE SET NULL,
    content         TEXT            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Índice para listar todas las notas de un cliente.
CREATE INDEX idx_clinical_notes_client_id
    ON clinical_notes (client_id);
