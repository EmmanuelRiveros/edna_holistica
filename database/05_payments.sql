-- ============================================================
-- 05_payments.sql
-- Tabla: payments
-- ============================================================
-- Decisiones de diseño:
--   • pending_amount como GENERATED ALWAYS: se calcula
--     automáticamente (total - paid), imposible que se
--     desincronice. Es de solo lectura, no se puede
--     insertar ni actualizar directamente.
--   • CHECK paid_amount <= total_amount: evita sobre-pagos.
--   • payment_method como VARCHAR con CHECK: extensible
--     sin ALTER TYPE (a diferencia de ENUMs).
--   • external_reference: almacena el ID de la pasarela
--     (MercadoPago, Stripe, etc.) para conciliación.
--   • Relación 1:N con reservations: soporta pagos
--     parciales y múltiples intentos de pago.
-- ============================================================

-- -----------------------------------------------------------
-- TABLA: payments
-- Pagos vinculados a una reserva.
-- -----------------------------------------------------------
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id      UUID            NOT NULL
                            REFERENCES reservations (id) ON DELETE CASCADE,
    payment_method      VARCHAR(20)     NOT NULL
                            CHECK (payment_method IN ('card', 'transfer', 'paypal', 'mercadopago', 'cash')),
    status              VARCHAR(15)     NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'partial', 'completed', 'refunded')),
    total_amount        DECIMAL(10, 2)  NOT NULL
                            CHECK (total_amount >= 0),
    paid_amount         DECIMAL(10, 2)  NOT NULL DEFAULT 0
                            CHECK (paid_amount >= 0),
    -- Columna generada: siempre refleja la diferencia real.
    -- No se puede insertar ni actualizar directamente.
    pending_amount      DECIMAL(10, 2)  GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    receipt_url         VARCHAR(500),
    external_reference  VARCHAR(255),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    -- Evita que se pague más de lo que se debe.
    CONSTRAINT chk_paid_not_exceeds_total
        CHECK (paid_amount <= total_amount)
);

-- Índice para buscar todos los pagos de una reserva.
CREATE INDEX idx_payments_reservation_id
    ON payments (reservation_id);
