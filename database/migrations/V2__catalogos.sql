-- Catálogos que usan los módulos del núcleo: laboratorios, máquinas, asistentes, calendario,
-- tarifas y roles internos (docs/08-componentes.md). Las horas van como time (admite 24:00) y
-- las fechas como date; el dinero en céntimos enteros (RN-27).

CREATE TABLE laboratorios (
  id      text PRIMARY KEY,
  nombre  text NOT NULL,
  campus  text NOT NULL
);

CREATE TABLE maquinas (
  id              text PRIMARY KEY,
  id_laboratorio  text NOT NULL REFERENCES laboratorios (id),
  codigo          text NOT NULL UNIQUE,
  en_servicio     boolean NOT NULL DEFAULT true
);
CREATE INDEX maquinas_por_laboratorio ON maquinas (id_laboratorio);

CREATE TABLE asistentes (
  id         text PRIMARY KEY,
  nombre     text NOT NULL,
  carne      text NOT NULL UNIQUE,
  categoria  text NOT NULL,
  activo     boolean NOT NULL DEFAULT true
);

-- Laboratorios en que un asistente puede cubrir turnos.
CREATE TABLE asistentes_laboratorios (
  id_asistente    text NOT NULL REFERENCES asistentes (id),
  id_laboratorio  text NOT NULL REFERENCES laboratorios (id),
  PRIMARY KEY (id_asistente, id_laboratorio)
);

-- Historial de topes semanales (RF-07): nunca se sobrescribe, se agrega una vigencia nueva.
CREATE TABLE topes_asistentes (
  id_asistente        text NOT NULL REFERENCES asistentes (id),
  vigente_desde       date NOT NULL,
  minutos_por_semana  integer NOT NULL CHECK (minutos_por_semana > 0),
  PRIMARY KEY (id_asistente, vigente_desde)
);

-- Disponibilidad declarada (RN-08): día 1 = lunes … 7 = domingo.
CREATE TABLE disponibilidad_asistentes (
  id_asistente  text NOT NULL REFERENCES asistentes (id),
  dia           smallint NOT NULL CHECK (dia BETWEEN 1 AND 7),
  hora_inicio   time NOT NULL,
  hora_fin      time NOT NULL,
  CHECK (hora_inicio < hora_fin),
  PRIMARY KEY (id_asistente, dia, hora_inicio)
);

CREATE TABLE semestres (
  id      text PRIMARY KEY,
  inicio  date NOT NULL,
  fin     date NOT NULL,
  CHECK (inicio <= fin),
  CONSTRAINT semestres_sin_traslape EXCLUDE USING gist (daterange(inicio, fin, '[]') WITH &&)
);

-- Tarifas versionadas como datos (ADR-0005): una vigencia nunca se traslapa con otra.
CREATE TABLE vigencias_tarifas (
  vigente_desde       date PRIMARY KEY,
  vigente_hasta       date,
  porcentaje_recargo  integer NOT NULL CHECK (porcentaje_recargo >= 0),
  CHECK (vigente_hasta IS NULL OR vigente_desde <= vigente_hasta),
  CONSTRAINT vigencias_tarifas_sin_traslape EXCLUDE USING gist (daterange(vigente_desde, vigente_hasta, '[]') WITH &&)
);

CREATE TABLE tarifas_por_categoria (
  vigente_desde      date NOT NULL REFERENCES vigencias_tarifas (vigente_desde),
  categoria          text NOT NULL,
  centimos_por_hora  bigint NOT NULL CHECK (centimos_por_hora >= 0),
  PRIMARY KEY (vigente_desde, categoria)
);

-- Roles internos de CompuLab (ADR-0008): no vienen del Directorio.
CREATE TABLE roles_usuarios (
  id_usuario      text NOT NULL,
  rol             text NOT NULL CHECK (rol IN ('ESTUDIANTE', 'ASISTENTE', 'COORDINADOR_LABORATORIO', 'COORDINADOR_SOPORTE')),
  id_laboratorio  text REFERENCES laboratorios (id),
  CHECK (rol <> 'COORDINADOR_LABORATORIO' OR id_laboratorio IS NOT NULL)
);
CREATE UNIQUE INDEX roles_usuarios_unicos ON roles_usuarios (id_usuario, rol, coalesce(id_laboratorio, ''));
