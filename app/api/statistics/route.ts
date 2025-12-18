import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ProcedureStatus, PaymentStatus, UserRole } from "@/app/generated/prisma/enums";

/**
 * Route API pour récupérer les statistiques complètes de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Construire le filtre selon le rôle
    const where: any = {};
    
    if (user.role === UserRole.USER) {
      where.userId = user.userId;
    } else if (user.role === UserRole.AVOCAT || user.role === UserRole.JURISTE) {
      where.avocatId = user.userId;
    }

    // 1. Statistiques par statut
    const statusCounts = await prisma.procedure.groupBy({
      by: ["status"],
      where,
      _count: {
        id: true,
      },
    });

    // 2. Montants totaux
    const totalAmounts = await prisma.procedure.aggregate({
      where,
      _sum: {
        montantDue: true,
      },
      _count: {
        id: true,
      },
    });

    // 3. Montants par statut
    const amountsByStatus = await prisma.procedure.groupBy({
      by: ["status"],
      where,
      _sum: {
        montantDue: true,
      },
    });

    // 4. Procédures résolues (montants récupérés)
    const resolvedProcedures = await prisma.procedure.aggregate({
      where: {
        ...where,
        status: ProcedureStatus.RESOLU,
      },
      _sum: {
        montantDue: true,
      },
      _count: {
        id: true,
      },
    });

    // 5. Paiements effectués
    const payments = await prisma.payment.findMany({
      where: {
        userId: user.userId,
        status: PaymentStatus.SUCCEEDED,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        createdAt: true,
        description: true,
        procedure: {
          select: {
            id: true,
            status: true,
            contexte: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    // 6. Évolution dans le temps (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const proceduresByDate = await prisma.procedure.findMany({
      where: {
        ...where,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        montantDue: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Grouper par jour
    const dailyStats: Record<string, { count: number; amount: number }> = {};
    proceduresByDate.forEach((p) => {
      const date  = new Date(p.createdAt).toISOString().split("T")[0];
      if (!dailyStats[date as string]) {
        dailyStats[date as string] = dailyStats[date as string] ?? { count: 0, amount: 0 };
        dailyStats[date as string]!.count++;
        dailyStats[date as string]!.amount += p.montantDue ?? 0;
      }
    });

    // 7. Procédures récentes (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentProcedures = await prisma.procedure.findMany({
      where: {
        ...where,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        contexte: true,
        montantDue: true,
        client: {
          select: {
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // 8. Taux de résolution
    const totalProcedures = totalAmounts._count.id || 0;
    const resolvedCount = resolvedProcedures._count.id || 0;
    const resolutionRate = totalProcedures > 0 
      ? (resolvedCount / totalProcedures) * 100 
      : 0;

    // 9. Temps moyen de résolution (en jours)
    // Note: createdAt et updatedAt sont toujours présents (non nullables) dans Prisma
    const resolvedWithDates = await prisma.procedure.findMany({
      where: {
        ...where,
        status: ProcedureStatus.RESOLU,
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let avgResolutionDays = 0;
    if (resolvedWithDates.length > 0) {
      const totalDays = resolvedWithDates.reduce((sum, p) => {
        const created = new Date(p.createdAt);
        const updated = new Date(p.updatedAt);
        const diffDays = Math.ceil(
          (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + diffDays;
      }, 0);
      avgResolutionDays = totalDays / resolvedWithDates.length;
    }

    // 10. Statistiques par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyProcedures = await prisma.procedure.findMany({
      where: {
        ...where,
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        montantDue: true,
      },
    });

    const monthlyStats: Record<string, { count: number; amount: number; resolved: number }> = {};
    monthlyProcedures.forEach((p) => {
      const date = new Date(p.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { count: 0, amount: 0, resolved: 0 };
      }
      monthlyStats[monthKey].count++;
      monthlyStats[monthKey].amount += p.montantDue || 0;
      if (p.status === ProcedureStatus.RESOLU) {
        monthlyStats[monthKey].resolved++;
      }
    });

    return NextResponse.json({
      statistics: {
        // Compteurs par statut
        statusCounts: statusCounts.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
        
        // Totaux
        totalProcedures,
        totalAmount: totalAmounts._sum.montantDue || 0,
        totalResolved: resolvedCount,
        totalResolvedAmount: resolvedProcedures._sum.montantDue || 0,
        totalPayments,
        paymentsCount: payments.length,
        
        // Montants par statut
        amountsByStatus: amountsByStatus.map((a) => ({
          status: a.status,
          amount: a._sum.montantDue || 0,
        })),
        
        // Taux de résolution
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
        
        // Évolution temporelle
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          count: stats.count,
          amount: stats.amount,
        })),
        
        monthlyStats: Object.entries(monthlyStats).map(([month, stats]) => ({
          month,
          count: stats.count,
          amount: stats.amount,
          resolved: stats.resolved,
        })),
        
        // Paiements récents
        recentPayments: payments.slice(0, 10),
        
        // Procédures récentes
        recentProcedures,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}

