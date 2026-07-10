const formatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(date: Date): string {
  if (date.getTime() === 0) return '';
  return formatter.format(date);
}
