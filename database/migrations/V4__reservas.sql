-- Reservas de máquinas (CU-11). Una reserva está activa —y ocupa su máquina— mientras está
-- ACTIVA o EN_USO (RN-17).

CREATE TABLE reservas (
  id               text PRIMARY KEY,
  id_estudiante    text NOT NULL,
  id_maquina       text NOT NULL REFERENCES maquinas (id),
  inicio           timestamptz NOT NULL,
  fin              timestamptz NOT NULL,
  franja           tstzrange GENERATED ALWAYS AS (tstzrange(inicio, fin, '[)')) STORED,
  estado           text NOT NULL CHECK (estado IN (
                     'ACTIVA', 'EN_USO', 'FINALIZADA', 'LIBERADA',
                     'CANCELADA_POR_ESTUDIANTE', 'CANCELADA_POR_SISTEMA')),
  clave_solicitud  text,
  CHECK (inicio < fin),
  -- ADR-0010: una clave de solicitud por estudiante
  CONSTRAINT reservas_clave_de_solicitud_unica UNIQUE (id_estudiante, clave_solicitud),
  -- ADR-0009, ext 7a: una máquina no tiene dos reservas activas a la vez
  CONSTRAINT reservas_sin_traslape_maquina EXCLUDE USING gist (id_maquina WITH =, franja WITH &&)
    WHERE (estado IN ('ACTIVA', 'EN_USO'))
);
CREATE INDEX reservas_por_estudiante ON reservas (id_estudiante, inicio);

-- RN-17, ext 7c: un estudiante tiene a lo sumo una reserva activa
CREATE UNIQUE INDEX reservas_una_activa_por_estudiante ON reservas (id_estudiante)
  WHERE estado IN ('ACTIVA', 'EN_USO');
