export type DocumentSequencePreview = {
  prefix: string;
  nextNumber: number;
  padding: number;
  resetYearly: boolean;
  sequenceYear: number;
};

export function formatDocumentNumberPreview(sequence: DocumentSequencePreview, now = new Date()): string {
  const year = now.getFullYear();
  const number = sequence.resetYearly && sequence.sequenceYear !== year ? 1 : sequence.nextNumber;
  return `${sequence.prefix.replaceAll("{YYYY}", String(year))}${String(number).padStart(sequence.padding, "0")}`;
}
