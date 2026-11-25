-- Cierres mensuales (CU-14). Un cierre CERRADO nunca cambia (RN-25): no hay UPDATE en el código.

CREATE TABLE cierres (
  anio               integer NOT NULL CHECK (anio BETWEEN 1970 AND 9998),
  mes                integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_de_cierre    timestamptz NOT NULL,
  estado             text NOT NULL DEFAULT 'CERRADO' CHECK (estado = 'CERRADO'),
  archivo_nombre     text NOT NULL,
  archivo_contenido  text NOT NULL,
  -- RN-26, ext 2c: un mes se cierra una sola vez
  CONSTRAINT cierres_un_cierre_por_mes PRIMARY KEY (anio, mes)
);

-- P5: copia de las tarifas aplicadas; tarifa_por_hora = {"A": 215000, "B": 260000} en céntimos.
CREATE TABLE tarifas_aplicadas (
  anio                integer NOT NULL,
  mes                 integer NOT NULL,
  vigente_desde       date NOT NULL,
  vigente_hasta       date,
  tarifa_por_hora     jsonb NOT NULL,
  porcentaje_recargo  integer NOT NULL,
  PRIMARY KEY (anio, mes, vigente_desde),
  FOREIGN KEY (anio, mes) REFERENCES cierres (anio, mes)
);

-- P3, P4: una línea por asistente con horas en el mes.
CREATE TABLE lineas_liquidacion (
  anio                 integer NOT NULL,
  mes                  integer NOT NULL,
  id_asistente         text NOT NULL,
  carne                text NOT NULL,
  nombre               text NOT NULL,
  categoria            text NOT NULL,
  minutos_normales     integer NOT NULL CHECK (minutos_normales >= 0),
  minutos_con_recargo  integer NOT NULL CHECK (minutos_con_recargo >= 0),
  monto_centimos       bigint NOT NULL CHECK (monto_centimos >= 0),
  PRIMARY KEY (anio, mes, id_asistente),
  FOREIGN KEY (anio, mes) REFERENCES cierres (anio, mes)
);

CREATE TABLE horas_no_pagadas (
  anio          integer NOT NULL,
  mes           integer NOT NULL,
  id_asistente  text NOT NULL,
  semana        date NOT NULL,
  motivo        text NOT NULL CHECK (motivo IN ('SOBRE_TOPE', 'MARCA_INCOMPLETA')),
  minutos       integer NOT NULL CHECK (minutos > 0),
  PRIMARY KEY (anio, mes, id_asistente, semana, motivo),
  FOREIGN KEY (anio, mes, id_asistente) REFERENCES lineas_liquidacion (anio, mes, id_asistente)
);
