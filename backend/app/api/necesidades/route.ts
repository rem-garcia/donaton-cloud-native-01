import { NecesidadRepository } from "@/src/repository/necesidadRepository";
import { NecesidadService } from "@/src/service/necesidadService";
import { NextRequest, NextResponse } from "next/server";

const necesidadRepository = new NecesidadRepository(),
      necesidadService = new NecesidadService(necesidadRepository);

export const GET = async () => {
    const necesidades = await necesidadService.obtenerNecesidades();

    return NextResponse.json(necesidades ?? [], { status: 200 });
};

export const POST = async (request: NextRequest) => {
    const body = await request.json();

    try {
        const nuevaNecesidad = await necesidadService.crearNecesidad(body);

        return NextResponse.json(nuevaNecesidad, { status: 201 });
    } catch(error) {
        const mensajeError = error instanceof Error ? error.message : "Error al crear la necesidad";

        return NextResponse.json({ error: mensajeError }, { status: 400 });
    };
};