import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { calculateCommission, CommissionSettings, Operator } from "./commission";

export interface ReportData {
  agentName: string;
  periodLabel: string;
  stats: {
    depots: number;
    retraits: number;
    vente: number;
    soldeNet: number;
    count: number;
  };
  commissionSettings: CommissionSettings;
  transactions: Array<{
    id: string;
    type: string;
    clientName: string;
    clientPhone: string;
    amount: number;
    operator: string;
    note?: string;
    createdAt: string;
  }>;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " FCFA";
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + 
         " " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    depot: "Dépôt",
    retrait: "Retrait",
    vente: "Vente",
  };
  return labels[type] || type;
}

export async function exportReportToPDF(data: ReportData): Promise<void> {
  try {
    // 1. Calculate stats per operator
    const opStats = {
      MTN: { depots: 0, retraits: 0, vente: 0, profit: 0, count: 0 },
      Moov: { depots: 0, retraits: 0, vente: 0, profit: 0, count: 0 },
      Celtis: { depots: 0, retraits: 0, vente: 0, profit: 0, count: 0 },
    };

    let totalProfit = 0;

    data.transactions.forEach((tx) => {
      const op = tx.operator as Operator;
      if (!opStats[op]) return;

      const comm = calculateCommission(
        tx.type as any,
        tx.amount,
        op,
        data.commissionSettings
      );

      opStats[op].count += 1;
      opStats[op].profit += comm;
      totalProfit += comm;

      if (tx.type === "depot") {
        opStats[op].depots += tx.amount;
      } else if (tx.type === "retrait") {
        opStats[op].retraits += tx.amount;
      } else if (tx.type === "vente") {
        opStats[op].vente += tx.amount;
      }
    });

    // 2. Build operator breakdown rows
    const operators: Operator[] = ["MTN", "Moov", "Celtis"];
    const opRowsHtml = operators
      .map((op) => {
        const stats = opStats[op];
        const totalVolume = stats.depots + stats.retraits + stats.vente;
        let brandColor = "#FFC80A"; // MTN
        let textColor = "#000000";
        if (op === "Moov") {
          brandColor = "#00C3FF";
          textColor = "#ffffff";
        } else if (op === "Celtis") {
          brandColor = "#64FF96";
          textColor = "#000000";
        }

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">
              <span style="background-color: ${brandColor}; color: ${textColor}; padding: 3px 8px; borderRadius: 4px; font-size: 11px;">${op}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(stats.depots)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(stats.retraits)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCurrency(stats.vente)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #1a7a4a;">+ ${formatCurrency(stats.profit)}</td>
          </tr>
        `;
      })
      .join("");

    // 3. Build transaction rows with commission
    const transactionRows = data.transactions
      .map((tx) => {
        const comm = calculateCommission(
          tx.type as any,
          tx.amount,
          tx.operator as Operator,
          data.commissionSettings
        );

        let typeColor = "#1a7a4a"; // depot
        if (tx.type === "retrait") typeColor = "#b00000";
        else if (tx.type === "vente") typeColor = "#191970";

        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; color: #555;">${formatDateTime(tx.createdAt)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-weight: bold; color: ${typeColor};">${getTransactionTypeLabel(tx.type)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${tx.clientName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; color: #555;">${tx.clientPhone}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; font-weight: bold;">${tx.operator}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: right; font-weight: bold;">${formatCurrency(tx.amount)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; text-align: right; font-weight: bold; color: #1a7a4a;">+ ${formatCurrency(comm)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Rapport Tcha-Tcha</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              margin: 30px;
              color: #333;
              line-height: 1.4;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #191970;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .logo {
              font-size: 28px;
              font-weight: 800;
              color: #191970;
              letter-spacing: 1px;
            }
            .report-title {
              font-size: 14px;
              text-transform: uppercase;
              color: #666;
              font-weight: bold;
              text-align: right;
            }
            .meta-section {
              margin-bottom: 25px;
              background-color: #f8f9fa;
              border-radius: 8px;
              padding: 15px;
              font-size: 13px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .meta-item {
              margin-bottom: 5px;
            }
            .meta-label {
              font-weight: bold;
              color: #555;
            }
            .metrics-summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .metric-card {
              background-color: #f1f3f9;
              border-left: 4px solid #191970;
              border-radius: 6px;
              padding: 15px 10px;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }
            .metric-card.profit {
              background-color: #f0fdf4;
              border-left-color: #16a34a;
            }
            .metric-label {
              font-size: 11px;
              text-transform: uppercase;
              color: #666;
              margin-bottom: 6px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .metric-value {
              font-size: 16px;
              font-weight: bold;
              color: #191970;
            }
            .metric-card.profit .metric-value {
              color: #16a34a;
            }
            .section-title {
              font-size: 15px;
              font-weight: bold;
              margin-top: 30px;
              margin-bottom: 12px;
              color: #191970;
              text-transform: uppercase;
              border-bottom: 1px solid #ddd;
              padding-bottom: 6px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            th {
              background-color: #191970;
              color: white;
              padding: 10px;
              text-align: left;
              font-size: 11px;
              text-transform: uppercase;
            }
            th.amount-col {
              text-align: right;
            }
            td {
              padding: 8px;
              border-bottom: 1px solid #eee;
            }
            .total-row {
              font-weight: bold;
              background-color: #f8f9fa;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 10px;
              color: #999;
              border-top: 1px solid #eee;
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo">TCHA-TCHA</div>
            <div class="report-title">Rapport d'Activité & Bénéfices</div>
          </div>

          <div class="meta-section">
            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Agent :</span> ${data.agentName}
              </div>
              <div class="meta-item" style="text-align: right;">
                <span class="meta-label">Période :</span> ${data.periodLabel}
              </div>
              <div class="meta-item">
                <span class="meta-label">Mode de calcul :</span> ${data.commissionSettings.useProgressiveGrid ? "Grille progressive officielle" : "Pourcentages personnalisés"}
              </div>
              <div class="meta-item" style="text-align: right;">
                <span class="meta-label">Généré le :</span> ${formatDateTime(new Date().toISOString())}
              </div>
            </div>
          </div>

          <div class="metrics-summary">
            <div class="metric-card">
              <div class="metric-label">Total Dépôts</div>
              <div class="metric-value" style="color: #191970;">${formatCurrency(data.stats.depots)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Retraits</div>
              <div class="metric-value" style="color: #b00000;">${formatCurrency(data.stats.retraits)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Ventes</div>
              <div class="metric-value" style="color: #191970;">${formatCurrency(data.stats.vente)}</div>
            </div>
            <div class="metric-card profit">
              <div class="metric-label">Bénéfices Est.</div>
              <div class="metric-value">+ ${formatCurrency(totalProfit)}</div>
            </div>
          </div>

          <div class="section-title">Répartition par Carte SIM</div>
          <table>
            <thead>
              <tr>
                <th>Support / SIM</th>
                <th class="amount-col">Volume Dépôts</th>
                <th class="amount-col">Volume Retraits</th>
                <th class="amount-col">Volume Ventes</th>
                <th class="amount-col">Bénéfice Estimé</th>
              </tr>
            </thead>
            <tbody>
              ${opRowsHtml}
              <tr class="total-row">
                <td style="padding: 10px;">TOTAL</td>
                <td style="padding: 10px; text-align: right;">${formatCurrency(data.stats.depots)}</td>
                <td style="padding: 10px; text-align: right;">${formatCurrency(data.stats.retraits)}</td>
                <td style="padding: 10px; text-align: right;">${formatCurrency(data.stats.vente)}</td>
                <td style="padding: 10px; text-align: right; color: #16a34a;">+ ${formatCurrency(totalProfit)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Détail des Transactions (${data.transactions.length})</div>
          ${
            data.transactions.length === 0
              ? '<div style="text-align: center; padding: 30px; color: #999; font-style: italic;">Aucune transaction sur cette période.</div>'
              : `
            <table>
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>SIM</th>
                  <th class="amount-col">Montant</th>
                  <th class="amount-col">Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows}
              </tbody>
            </table>
          `
          }

          <div class="footer">
            Document officiel généré via l'application Tcha-Tcha. Bénéfices calculés à titre indicatif.
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Rapport Tcha-Tcha ${data.periodLabel}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Succès", `Rapport généré.\nEmplacement: ${uri}`);
    }
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    Alert.alert("Erreur", "Impossible de générer le rapport PDF.");
  }
}
