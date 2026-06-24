import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

export interface ReportData {
  agentName: string;
  date: string;
  stats: {
    depots: number;
    retraits: number;
    soldeNet: number;
    count: number;
  };
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
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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
    const transactionRows = data.transactions
      .map((tx) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">${formatTime(tx.createdAt)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">${getTransactionTypeLabel(tx.type)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">${tx.clientName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">${tx.clientPhone}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px;">${tx.operator}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 12px; text-align: right;">${formatCurrency(tx.amount)} FCFA</td>
        </tr>
      `)
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Rapport Journalier - Tcha-Tcha</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            h1 {
              text-align: center;
              color: #191970;
              margin-bottom: 10px;
            }
            .header-info {
              text-align: center;
              margin-bottom: 20px;
              font-size: 12px;
              color: #666;
            }
            .agent-name {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 20px;
            }
            .metrics {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .metric-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 12px;
              text-align: center;
            }
            .metric-label {
              font-size: 11px;
              color: #666;
              margin-bottom: 4px;
            }
            .metric-value {
              font-size: 16px;
              font-weight: bold;
              color: #191970;
            }
            .metric-value.positive {
              color: #1a7a4a;
            }
            .metric-value.negative {
              color: #b00000;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #191970;
              color: white;
              padding: 10px;
              text-align: left;
              font-size: 12px;
            }
            td {
              padding: 8px;
              border-bottom: 1px solid #e0e0e0;
              font-size: 12px;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              margin-top: 20px;
              margin-bottom: 10px;
              color: #191970;
            }
            .empty {
              text-align: center;
              padding: 20px;
              color: #999;
              font-style: italic;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #999;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <h1>TCHA-TCHA</h1>
          <div class="header-info">Rapport Journalier</div>
          <div class="agent-name">Agent: ${data.agentName}</div>
          <div class="header-info">Date: ${formatDate(data.date)}</div>

          <div class="metrics">
            <div class="metric-card">
              <div class="metric-label">Total Dépôts</div>
              <div class="metric-value positive">${formatCurrency(data.stats.depots)} FCFA</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Retraits</div>
              <div class="metric-value negative">${formatCurrency(data.stats.retraits)} FCFA</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Solde Net</div>
              <div class="metric-value ${data.stats.soldeNet >= 0 ? "positive" : "negative"}">${formatCurrency(data.stats.soldeNet)} FCFA</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Nb Transactions</div>
              <div class="metric-value">${data.stats.count}</div>
            </div>
          </div>

          <div class="section-title">Détail des Transactions</div>
          ${
            data.transactions.length === 0
              ? '<div class="empty">Aucune transaction ce jour.</div>'
              : `
            <table>
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Opérateur</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows}
              </tbody>
            </table>
          `
          }

          <div class="footer">
            Document généré le ${formatDate(new Date().toISOString())} à ${formatTime(new Date().toISOString())}
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Rapport du ${formatDate(data.date)}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Succès", `Rapport généré et prêt à être partagé.\nEmplacement: ${uri}`);
    }
  } catch (error) {
    console.error("Erreur lors de la génération du PDF:", error);
    Alert.alert("Erreur", "Impossible de générer le rapport PDF.");
  }
}
