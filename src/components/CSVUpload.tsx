import { ChangeEvent, useRef, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { parsePlayersCsv } from '@/lib/csvImportPlayers';

export const CSVUpload = () => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const csvText = await file.text();
      const rows = parsePlayersCsv(csvText);
      if (!rows.length) {
        toast({ title: 'No valid rows found', variant: 'destructive' });
        return;
      }

      let created = 0;
      let skipped = 0;

      for (const row of rows) {
        const duplicateSnap = await getDocs(query(collection(db, 'players'), where('name', '==', row.name)));
        if (!duplicateSnap.empty) {
          skipped += 1;
          continue;
        }

        await addDoc(collection(db, 'players'), {
          name: row.name,
          role: row.role,
          rating: Number(row.rating),
          basePrice: Number(row.basePrice),
          pool: row.pool,
          previousTeamId: row.previousTeamId || null,
          overseas: Boolean(row.overseas),
          nationality: row.nationality || '',
          image: row.image || '',
          isCapped: Boolean(row.isCapped),
          createdAt: serverTimestamp(),
        });
        created += 1;
      }

      toast({ title: 'CSV imported', description: `Added ${created}, skipped ${skipped} duplicate players.` });
    } catch (error) {
      toast({ title: 'CSV import failed', description: 'Check CSV header order and values.', variant: 'destructive' });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
      <Button variant="outline" disabled={importing} onClick={() => inputRef.current?.click()}>
        {importing ? 'Importing CSV…' : 'Bulk Upload CSV'}
      </Button>
    </>
  );
};
