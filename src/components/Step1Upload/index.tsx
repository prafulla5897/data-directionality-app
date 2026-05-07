/**
 * Step 1 — File upload zone.
 * Handles single-file and two-file upload with validation, size warnings, and schema detection.
 */

import { useRef, useState } from 'react';
import type { RawRow, Schema, ColumnMapping } from '../../types/index.js';
import { validateFile, parseFile } from '../../utils/parser.js';
import { detectSchema } from '../../utils/schemaDetector.js';
import { suggestColumnMappings, mergeFiles } from '../../utils/fileMerger.js';
import { THRESHOLDS } from '../../constants/index.js';
import { MergeMapping } from './MergeMapping.js';
import styles from './Step1Upload.module.css';

interface Step1UploadProps {
  onComplete: (rows: RawRow[], schema: Schema, mergedFromTwoFiles: boolean) => void;
}

type Phase = 'idle' | 'sizeWarning' | 'mergeMapping' | 'processing';

interface FileState {
  file: File | null;
  rows: RawRow[];
  schema: Schema | null;
}

/**
 * Upload zone for one or two files.
 * Validates, parses, and detects schema before calling onComplete.
 * @param props - onComplete callback for when upload and schema detection succeed
 * @returns JSX upload zone
 */
export function Step1Upload({ onComplete }: Step1UploadProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle');
  const [drag1, setDrag1] = useState(false);
  const [drag2, setDrag2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [file1State, setFile1State] = useState<FileState>({ file: null, rows: [], schema: null });
  const [file2State, setFile2State] = useState<FileState>({ file: null, rows: [], schema: null });
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const input1Ref = useRef<HTMLInputElement>(null);
  const input2Ref = useRef<HTMLInputElement>(null);

  function sizeMB(f: File): number {
    return f.size / (1024 * 1024);
  }

  async function processFile(file: File): Promise<{ rows: RawRow[]; schema: Schema }> {
    const rows = await parseFile(file);
    const cols = Object.keys(rows[0] ?? {});
    const schema = detectSchema(cols, rows.slice(0, 20));
    return { rows, schema };
  }

  function handleSingleFileDone(rows: RawRow[], schema: Schema): void {
    onComplete(rows, schema, false);
  }

  function clearFile1(): void {
    setFile1State({ file: null, rows: [], schema: null });
    setError(null);
    if (input1Ref.current) input1Ref.current.value = '';
  }

  function clearFile2(): void {
    setFile2State({ file: null, rows: [], schema: null });
    setError(null);
    if (input2Ref.current) input2Ref.current.value = '';
  }

  async function handleFile1(file: File): Promise<void> {
    setError(null);
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error ?? 'Invalid file.'); return; }

    if (sizeMB(file) > THRESHOLDS.FILE_SIZE_WARN_MB) {
      const proceed = async (): Promise<void> => {
        setPhase('processing');
        try {
          const { rows, schema } = await processFile(file);
          setFile1State({ file, rows, schema });
          if (file2State.file) {
            await triggerMerge({ file, rows, schema }, file2State);
          } else {
            setPhase('idle');
          }
        } catch (e) { setError(e instanceof Error ? e.message : 'Parse error.'); setPhase('idle'); }
      };
      setWarningMsg('Large file — processing may take ~30 seconds.');
      setPendingAction(() => proceed);
      setPhase('sizeWarning');
      return;
    }

    setPhase('processing');
    try {
      const { rows, schema } = await processFile(file);
      setFile1State({ file, rows, schema });
      if (file2State.file && file2State.schema) {
        await triggerMerge({ file, rows, schema }, file2State);
      } else {
        setPhase('idle');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Parse error.'); setPhase('idle'); }
  }

  async function handleFile2(file: File): Promise<void> {
    setError(null);
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error ?? 'Invalid file.'); return; }

    setPhase('processing');
    try {
      const { rows, schema } = await processFile(file);
      setFile2State({ file, rows, schema });
      if (file1State.schema) {
        await triggerMerge(file1State, { file, rows, schema });
      } else {
        setPhase('idle');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Parse error.'); setPhase('idle'); }
  }

  async function triggerMerge(
    f1: { file: File | null; rows: RawRow[]; schema: Schema | null },
    f2: { file: File | null; rows: RawRow[]; schema: Schema | null }
  ): Promise<void> {
    if (!f1.schema || !f2.schema) return;
    const suggested = suggestColumnMappings(f1.schema, f2.schema);
    setMappings(suggested);
    setFile1State(prev => ({ ...prev, rows: f1.rows, schema: f1.schema, file: f1.file }));
    setFile2State(prev => ({ ...prev, rows: f2.rows, schema: f2.schema, file: f2.file }));
    setPhase('mergeMapping');
  }

  function confirmMappings(confirmed: ColumnMapping[]): void {
    try {
      const merged = mergeFiles(file1State.rows, file2State.rows, confirmed);
      const cols = Object.keys(merged[0] ?? {});
      const mergedSchema = detectSchema(cols, merged.slice(0, 20));
      onComplete(merged, mergedSchema, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge error.');
      setPhase('idle');
    }
  }

  function onDrop1(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault(); setDrag1(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile1(f);
  }

  function onDrop2(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault(); setDrag2(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile2(f);
  }

  if (phase === 'mergeMapping' && file1State.schema && file2State.schema) {
    return (
      <div className={styles.container}>
        <MergeMapping
          schema1={file1State.schema}
          schema2={file2State.schema}
          initialMappings={mappings}
          onConfirm={confirmMappings}
          onBack={() => setPhase('idle')}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div>
        <h2 className={styles.heading}>Upload your data</h2>
        <p className={styles.subheading}>CSV, XLSX, or XLS — up to 50 MB</p>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {phase === 'sizeWarning' && warningMsg && (
        <div className={styles.warning} role="alert">
          <span>{warningMsg}</span>
          <div className={styles.warningActions}>
            <button className={styles.btnSecondary} onClick={() => { setPhase('idle'); setPendingAction(null); }}>Cancel</button>
            <button className={styles.btnPrimary} onClick={() => { pendingAction?.(); }}>Proceed anyway</button>
          </div>
        </div>
      )}

      {/* File 1 drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop your primary file here or click to select"
        className={[
          styles.dropZone,
          drag1 ? styles.dropZoneActive : '',
          file1State.file ? styles.dropZoneHasFile : '',
        ].join(' ')}
        onClick={() => input1Ref.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input1Ref.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setDrag1(true); }}
        onDragLeave={() => setDrag1(false)}
        onDrop={onDrop1}
      >
        {phase === 'processing' && !file1State.file
          ? <span className={styles.dropZoneLabel}><span className={styles.spinner} />Parsing…</span>
          : file1State.file
            ? <>
                <span className={styles.dropZoneFileName}>{file1State.file.name}</span>
                {file1State.rows.length > 0 && (
                  <p className={styles.rowCount}>{file1State.rows.length.toLocaleString()} rows detected</p>
                )}
                <button
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.8rem', padding: '4px 10px', marginTop: 'var(--space-2)' }}
                  onClick={e => { e.stopPropagation(); clearFile1(); }}
                  aria-label="Remove file 1"
                >
                  Remove
                </button>
              </>
            : <>
                <span className={styles.dropZoneLabel}>Drop file here or click to select</span>
                <p className={styles.dropZoneSecondary}>Primary data file (required)</p>
              </>
        }
        <input
          ref={input1Ref}
          type="file"
          accept=".csv,.xlsx,.xls"
          className={styles.hiddenInput}
          aria-hidden="true"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile1(f); e.target.value = ''; }}
        />
      </div>

      {file1State.rows.length > 0 && phase === 'idle' && !file2State.file && (
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={() => { if (file1State.schema) handleSingleFileDone(file1State.rows, file1State.schema); }}
          >
            Continue to schema →
          </button>
        </div>
      )}

      {/* File 2 drop zone */}
      <div className={styles.file2Section}>
        <span className={styles.file2Label}>Second file (optional — for merging two data sources)</span>
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop your optional second file here or click to select"
          className={[
            styles.file2DropZone,
            drag2 ? styles.file2DropZoneActive : '',
            file2State.file ? styles.file2HasFile : '',
          ].join(' ')}
          onClick={() => input2Ref.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input2Ref.current?.click(); }}
          onDragOver={e => { e.preventDefault(); setDrag2(true); }}
          onDragLeave={() => setDrag2(false)}
          onDrop={onDrop2}
        >
          {file2State.file
            ? <>
                <span>{file2State.file.name}</span>
                <button
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.8rem', padding: '4px 10px', marginTop: 'var(--space-2)' }}
                  onClick={e => { e.stopPropagation(); clearFile2(); }}
                  aria-label="Remove file 2"
                >
                  Remove
                </button>
              </>
            : <span>Drop second file here or click to select</span>
          }
          <input
            ref={input2Ref}
            type="file"
            accept=".csv,.xlsx,.xls"
            className={styles.hiddenInput}
            aria-hidden="true"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile2(f); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}
