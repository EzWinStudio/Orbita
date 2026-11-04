import type { Currency } from '../types';
import { formatMoney } from '../lib/format';
import { useI18n } from '../i18n';

export interface DayPerformance {
  key: string;
  label: string;
  income: number;
  expense: number;
  tasks: number;
}

interface WeeklyBarsProps {
  days: DayPerformance[];
  currency: Currency;
}

export function WeeklyBars({ days, currency }: WeeklyBarsProps) {
  const { t } = useI18n();
  const max = Math.max(...days.flatMap((day) => [day.income, day.expense]), 1);
  const hasData = days.some((day) => day.income > 0 || day.expense > 0 || day.tasks > 0);

  return (
    <div className="chart chart-week">
      <div className="chart-top">
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-swatch legend-income" /> {t('Gelir')}
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-expense" /> {t('Gider')}
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-task" /> {t('Tamamlanan görev')}
          </span>
        </div>
        {hasData ? (
          <span className="chart-scale">
            {t('En yüksek: {amount}', { amount: formatMoney(max, currency) })}
          </span>
        ) : null}
      </div>
      <div className="chart-plot">
        {days.map((day, index) => {
          const incomeHeight = day.income > 0 ? Math.max(2, (day.income / max) * 100) : 0;
          const expenseHeight = day.expense > 0 ? Math.max(2, (day.expense / max) * 100) : 0;
          const isLast = index === days.length - 1;
          return (
            <div className={`bar-group ${isLast ? 'bar-current' : ''}`} key={day.key}>
              <div className="bar-pair">
                <div
                  className="bar bar-income"
                  style={{ height: `${incomeHeight}%` }}
                  title={t('{month} geliri: {amount}', {
                    month: day.label,
                    amount: formatMoney(day.income, currency),
                  })}
                />
                <div
                  className="bar bar-expense"
                  style={{ height: `${expenseHeight}%` }}
                  title={t('{month} gideri: {amount}', {
                    month: day.label,
                    amount: formatMoney(day.expense, currency),
                  })}
                />
              </div>
              <span className="bar-label">{day.label}</span>
              <span
                className={`week-task-count ${day.tasks > 0 ? 'has-tasks' : ''}`}
                title={t('{count} tamamlanan görev', { count: day.tasks })}
              >
                {day.tasks > 0 ? day.tasks : ''}
              </span>
            </div>
          );
        })}
        {!hasData && <div className="chart-empty">{t('Bu hafta için kayıt yok')}</div>}
      </div>
    </div>
  );
}
