import dayjs from 'dayjs';
import type { DateRange } from '../types';

/**
 * 获取今日日期范围
 */
export function getTodayRange(): DateRange {
  const today = dayjs();
  return {
    start: today.startOf('day').toDate(),
    end: today.endOf('day').toDate()
  };
}

/**
 * 获取本周日期范围（周一到周日）
 */
export function getThisWeekRange(): DateRange {
  const today = dayjs();
  return {
    start: today.startOf('week').add(1, 'day').toDate(), // 周一
    end: today.endOf('week').add(1, 'day').toDate() // 周日
  };
}

/**
 * 获取上周日期范围
 */
export function getLastWeekRange(): DateRange {
  const today = dayjs();
  const lastWeekStart = today.startOf('week').subtract(6, 'day');
  return {
    start: lastWeekStart.toDate(),
    end: lastWeekStart.add(6, 'day').endOf('day').toDate()
  };
}

/**
 * 格式化日期为字符串
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化日期范围为文件名
 */
export function formatDateRangeForFilename(range: DateRange): string {
  const start = formatDate(range.start);
  const end = formatDate(range.end);
  if (start === end) {
    return start;
  }
  return `${start}_${end}`;
}

/**
 * 解析日期字符串
 */
export function parseDate(dateStr: string): Date {
  return dayjs(dateStr).toDate();
}

/**
 * 检查日期是否在范围内
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  const d = dayjs(date);
  return d.isAfter(dayjs(range.start).subtract(1, 'second')) &&
         d.isBefore(dayjs(range.end).add(1, 'second'));
}
