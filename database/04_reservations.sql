-- ============================================================
-- 04_reservations.sql
-- Tabla: reservations
-- ============================================================
-- Decisiones de diseño:
--   • Motor unificado: una sola tabla cubre reservas de
--     servicios individuales y talleres grupales.
--   • CHECK de exclusividad XOR: exactamente una FK
--     (service_id o workshop_id) debe tener valor.
--   • client_id permite NULL con SET NULL: si el usuario se
--     elimina (soft o hard), la reserva histórica persiste
--     sin referencia rota. El borrado lógico se controla
--     desde la capa de aplicación.
--   • therapist_id SET NULL: si un terapeuta deja la
--     plataforma, la reserva persiste sin asignar.
--   • service_id / workshop_id SET NULL: la reserva
--     histórica persiste aunque el servicio/taller se borre.
-- ============================================================

-- -----------------------------------------------------------
-- TABLA: reservations
-- Un cliente reserva un servicio individual O un taller.
-- -----------------------------------------------------------
CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID
                        REFERENCES users (id) ON DELETE SET NULL,
    therapist_id    UUID
                        REFERENCES users (id) ON DELETE SET NULL,
    service_id      UUID
                        REFERENCES services (id) ON DELETE SET NULL,
    workshop_id     UUID
                        REFERENCES workshops (id) ON DELETE SET NULL,
    scheduled_at    TIMESTAMPTZ     NOT NULL,
    status          VARCHAR(15)     NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- ========================================================
    -- CHECK de exclusividad: exactamente UNO de los dos debe
    -- tener valor. Impide reservas "huérfanas" (sin tipo) y
    -- reservas ambiguas (de servicio Y taller a la vez).
    -- ========================================================
    CONSTRAINT chk_reservation_type_exclusivity
        CHECK (
            (service_id IS NOT NULL AND workshop_id IS NULL)
            OR
            (service_id IS NULL AND workshop_id IS NOT NULL)
        )
);

-- Índice para listar todas las reservas de un cliente.
CREATE INDEX idx_reservations_client_id
    ON reservations (client_id);

-- Índice para consultas por rango de fechas (ej: agenda del día).
CREATE INDEX idx_reservations_scheduled_at
    ON reservations (scheduled_at);
