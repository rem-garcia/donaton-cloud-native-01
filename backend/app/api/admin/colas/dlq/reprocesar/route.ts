import { GestionColasService } from "@/src/service/gestionColasService";
import { NextRequest, NextResponse } from "next/server";

const gestionColasService = new GestionColasService();

export const POST = async (request: NextRequest) => {
    const { cola, msgId } = await request.json();

    try {
        const resultado = await gestionColasService.reprocesar(cola, Number(msgId));

        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        const mensajeError = error instanceof Error ? error.message : "Error al reprocesar";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    }
};