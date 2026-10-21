export interface MetricaCola {
    cola: string;
    largo: number;
    masNuevoSeg: number | null;
    masAntiguoSeg: number | null;
    totalHistorico: number;
}

export interface MensajeCola<T> {
    msgId: number;
    intentos: number;
    encoladoEn: string;
    mensaje: T;
}

// Lo que guarda moverADlq() en queue.ts
export interface MensajeDlq {
    original: unknown;
    origen: string;
    msgIdOriginal: number;
    intentos: number;
    motivo: string;
    movidoEn: string;
}

// Lo que se encola en alertas_sistema
export interface Alerta {
    tipo: string;
    dlq: string;
    origen: string;
    msgIdOriginal: number;
    motivo: string;
    creadoEn: string;
}

export interface MensajeArchivado extends MensajeCola<unknown> {
    archivadoEn: string;
}

export interface DetalleCola {
    cola: string;
    pendientes: MensajeCola<unknown>[];
    procesados: MensajeArchivado[];
    totalProcesados: number;
}