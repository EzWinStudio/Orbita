import type { Currency } from '../types';
import { formatMoney } from '../lib/format';
import { useI18n } from '../i18n';

export interface MonthFinances {
  key: string;
  label: string;
  income: number;
  expense: number;
}

interface MonthlyBarsProps {
  months: MonthFinances[];
  currency: Currency;
  compact?: boolean;
}

export function MonthlyBars({ months, currency, compact = false }: MonthlyBarsProps) {
  const { t } = useI18n();
  const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  const hasData = months.some((m) => m.income > 0 || m.expense > 0);

  return (
    <div className={`chart ${compact ? 'chart-compact' : ''}`}>
      <div className="chart-top">
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-swatch legend-income" /> {t('Gelir')}
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-expense" /> {t('Gider')}
          </span>
        </div>
        {!compact && hasData ? (
          <span className="chart-scale">
            {t('En yüksek: {amount}', { amount: formatMoney(max, currency) })}
          </span>
        ) : null}
      </div>
      <div className="chart-plot">
        {months.map((month, index) => {
          const incomeHeight = month.income > 0 ? Math.max(2, (month.income / max) * 100) : 0;
          const expenseHeight = month.expense > 0 ? Math.max(2, (month.expense / max) * 100) : 0;
          const isLast = index === months.length - 1;
          return (
            <div className={`bar-group ${isLast ? 'bar-current' : ''}`} key={month.key}>
              <div className="bar-pair">
                <div
                  className="bar bar-income"
                  style={{ height: `${incomeHeight}%` }}
                  title={t('{month} geliri: {amount}', {
                    month: month.label,
                    amount: formatMoney(month.income, currency),
                  })}
                />
                <div
                  className="bar bar-expense"
                  style={{ height: `${expenseHeight}%` }}
                  title={t('{month} gideri: {amount}', {
                    month: month.label,
                    amount: formatMoney(month.expense, currency),
                  })}
                />
              </div>
              <span className="bar-label">{month.label}</span>
            </div>
          );
        })}
        {!hasData && <div className="chart-empty">{t('Henüz finans kaydı yok')}</div>}
      </div>
    </div>
  );
}
