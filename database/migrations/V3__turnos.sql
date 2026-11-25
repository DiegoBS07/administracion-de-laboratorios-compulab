-- Turnos (CU-06) y marcas de asistencia. La franja es [inicio, fin): dos turnos contiguos no se
-- traslapan. Un turno ocupa su franja en todos sus estados salvo VACANTE y DESCARTADO (10.5).

CREATE TABLE turnos (
  id               text PRIMARY KEY,
  id_laboratorio   text NOT NULL REFERENCES laboratorios (id),
  id_asistente     text REFERENCES asistentes (id),
  inicio           timestamptz NOT NULL,
  fin              timestamptz NOT NULL,
  franja           tstzrange GENERATED ALWAYS AS (tstzrange(inicio, fin, '[)')) STORED,
  estado           text NOT NULL CHECK (estado IN (
                     'PENDIENTE_ACEPTACION', 'ASIGNADO', 'EN_CURSO', 'CUBIERTO',
                     'NO_CUBIERTO', 'MARCA_INCOMPLETA', 'VACANTE', 'DESCARTADO')),
  creado_por       text,
  clave_solicitud  text,
  CHECK (inicio < fin),
  -- I4 / SUP-01: exactamente un responsable, salvo cuando está vacante
  CHECK ((estado = 'VACANTE') = (id_asistente IS NULL)),
  -- ADR-0010: una clave de solicitud por usuario
  CONSTRAINT turnos_clave_de_solicitud_unica UNIQUE (creado_por, clave_solicitud),
  -- ADR-0009, segunda barrera de RN-06: un asistente no tiene dos turnos a la vez
  CONSTRAINT turnos_sin_traslape_asistente EXCLUDE USING gist (id_asistente WITH =, franja WITH &&)
    WHERE (estado NOT IN ('VACANTE', 'DESCARTADO')),
  -- ADR-0009, RN-09: un laboratorio tiene un solo turno por franja
  CONSTRAINT turnos_sin_traslape_laboratorio EXCLUDE USING gist (id_laboratorio WITH =, franja WITH &&)
    WHERE (estado NOT IN ('VACANTE', 'DESCARTADO'))
);
CREATE INDEX turnos_por_inicio ON turnos (inicio);

-- Marcas de entrada y salida (módulo asistencia, fuera del núcleo: aquí solo se guardan).
CREATE TABLE marcas (
  id_turno  text PRIMARY KEY REFERENCES turnos (id),
  entrada   timestamptz NOT NULL,
  salida    timestamptz,
  CHECK (salida IS NULL OR entrada < salida)
);
