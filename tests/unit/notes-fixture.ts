import { LibraryDatabase, LibraryRepository } from '../../src/library/repository';
import { NoteRepository } from '../../src/notes/repository';
import { CitationRepository } from '../../src/citations/repository';
import { createAnchor } from '../../src/citations/anchors';
import { parseRequest, type BridgeCommand, type Operation } from '../../src/external/protocol';

export async function noteFixture() {
  const database = new LibraryDatabase('notes-' + crypto.randomUUID());
  const book = await new LibraryRepository(database).commit({ hash: 'asset', file: new Blob(['pdf']), pages: 3,
    size: 3, thumbnail: '', createdAt: 0 }, 'book.pdf', { type: 'create' }, false);
  const source = { bookId: book.id, assetHash: 'asset', page: 1, rawText: 'source', anchor: createAnchor('source', 0, 6) };
  const citation = await new CitationRepository(database).save(source, 'quote', 'source');
  const repository = new NoteRepository(database);
  const command = (operation: Operation, params: Record<string, unknown>, requestId: string = crypto.randomUUID()): BridgeCommand =>
    ({ ...parseRequest({ operation, bookId: book.id, params, requestId }), clientId: 'window', expiresAt: Date.now() + 10000 });
  return { database, book, source, citation, repository, command };
}
