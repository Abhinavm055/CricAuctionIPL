import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SessionViewerProps {
  sessions: any[];
}

export const SessionViewer = ({ sessions }: SessionViewerProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Game Code</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead>Players Joined</TableHead>
          <TableHead>Selected Teams</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{s.id}</TableCell>
            <TableCell>{s.phase}</TableCell>
            <TableCell>{(s.playersJoined || []).length}</TableCell>
            <TableCell>{Object.keys(s.selectedTeams || {}).length}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
