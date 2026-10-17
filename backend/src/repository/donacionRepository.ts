import { DonacionCreateInput, DonacionUpsertArgs } from "@/prisma/generated/prisma/models";
import { prisma } from "../lib/prisma";
import { TOPICOS, publicarEvento } from "../lib/queue";

export class DonacionRepository {
    async getDonaciones() {
        return await prisma.donacion.findMany({ orderBy: { creadoEn: "desc" } });
    };

    async getDonacionById(id: number) {
        return await prisma.donacion.findUnique({ where: { id: id }});
    };

    async createDonacion(data: DonacionCreateInput) {
        return await prisma.donacion.create({ data: data });
    };

    async createDonacionConRecibo(data: DonacionCreateInput) {
        return await prisma.$transaction(async (tx) => {
            const donacion = await tx.donacion.create({ data: data });

            await publicarEvento(tx, TOPICOS.donacionCreada, {
                donacionId: donacion.id,
                correoDonante: donacion.correoDonante,
                nombreDonante: donacion.nombreDonante,
                tipo: donacion.tipo,
                cantidad: donacion.cantidad,
                peso: donacion.peso.toString(),
                creadoEn: donacion.creadoEn.toISOString(),
            });

            return donacion;
        });
    };

    async upsertDonacion(args: DonacionUpsertArgs) {
        return await prisma.donacion.upsert(args);
    };

    async deleteDonacionById(id: number) {
        return await prisma.donacion.delete({ where: { id: id }});
    };
};
