import {
  PRECIO_CON_LUZ,
  PRECIO_SIN_LUZ,
  horaPuestaDeSol,
  precioTurno,
  puestaDeSol,
  turnoConLuz,
} from "./precios";

const HORAS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];
const conLuz = (fecha) => HORAS.filter((h) => turnoConLuz(fecha, h));

// Puestas de sol de Open-Meteo para la pista (hora local de Madrid), con error aceptable de 3 minutos.
const REFERENCIAS = [
  ["2026-11-09", "18:15"],
  ["2026-11-15", "18:10"],
  ["2025-12-21", "18:05"],
  ["2026-03-28", "19:45"],
  ["2026-03-29", "20:46"],
];

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

describe("puesta de sol", () => {
  it.each(REFERENCIAS)("%s coincide con Open-Meteo (%s)", (fecha, esperada) => {
    expect(Math.abs(puestaDeSol(fecha) - aMinutos(esperada))).toBeLessThanOrEqual(3);
  });

  it("en verano ronda las 21:55 hora local", () => {
    expect(Math.abs(puestaDeSol("2026-06-21") - aMinutos("21:55"))).toBeLessThanOrEqual(3);
  });

  it("el último domingo de marzo salta una hora", () => {
    const diferencia = puestaDeSol("2026-03-29") - puestaDeSol("2026-03-28");
    expect(diferencia).toBeGreaterThan(55);
    expect(diferencia).toBeLessThan(65);
  });

  it("el último domingo de octubre vuelve una hora", () => {
    const diferencia = puestaDeSol("2026-10-25") - puestaDeSol("2026-10-24");
    expect(diferencia).toBeLessThan(-55);
    expect(diferencia).toBeGreaterThan(-65);
    expect(horaPuestaDeSol("2026-10-25")).toBe("18:33");
  });

  it("fecha no válida", () => {
    expect(puestaDeSol("")).toBeNull();
    expect(horaPuestaDeSol("hola")).toBe("");
    expect(turnoConLuz("hola", "18:00")).toBe(false);
  });
});

describe("turno con luz", () => {
  it("invierno (puesta 18:05): desde el turno de 18:00", () => {
    expect(conLuz("2026-12-21")).toEqual(["18:00", "19:30", "21:00", "22:30"]);
  });

  it("verano (puesta 21:56): solo 21:00 y 22:30", () => {
    expect(conLuz("2026-06-21")).toEqual(["21:00", "22:30"]);
  });

  it("borde de febrero: el 13 el turno de 18:00 tiene 30 min o más de noche; el 14 no", () => {
    expect(turnoConLuz("2026-02-13", "18:00")).toBe(true);
    expect(turnoConLuz("2026-02-14", "18:00")).toBe(false);
  });

  it("borde de septiembre: el 17 el turno de 19:30 aún no; el 18 sí", () => {
    expect(turnoConLuz("2026-09-17", "19:30")).toBe(false);
    expect(turnoConLuz("2026-09-18", "19:30")).toBe(true);
  });

  it("cambio de hora de marzo: la víspera 19:30 ya es con luz; el domingo, hasta las 21:00", () => {
    expect(conLuz("2026-03-28")).toEqual(["19:30", "21:00", "22:30"]);
    expect(conLuz("2026-03-29")).toEqual(["21:00", "22:30"]);
  });

  it("cambio de hora de octubre: el sábado empieza la luz a las 19:30; el domingo, a las 18:00", () => {
    expect(conLuz("2026-10-24")).toEqual(["19:30", "21:00", "22:30"]);
    expect(conLuz("2026-10-25")).toEqual(["18:00", "19:30", "21:00", "22:30"]);
  });

  it("el turno de mañana nunca tiene luz", () => {
    expect(turnoConLuz("2026-12-21", "09:00")).toBe(false);
    expect(turnoConLuz("2026-12-21", "10:30")).toBe(false);
  });

  it("precioTurno devuelve precio y conLuz", () => {
    expect(PRECIO_SIN_LUZ).toBe(8);
    expect(PRECIO_CON_LUZ).toBe(11);
    expect(precioTurno("2026-12-21", "10:30")).toEqual({ precio: 8, conLuz: false });
    expect(precioTurno("2026-12-21", "19:30")).toEqual({ precio: 11, conLuz: true });
  });
});
