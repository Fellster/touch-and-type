package com.keithfell.noted.personal;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Durable staging and byte-for-byte verification, independent of picker/callback options. */
final class BackupTransfer {
    private static final int MAX_BYTES = 64 * 1024 * 1024;
    interface OutputOpener { OutputStream open() throws IOException; }
    interface InputOpener { InputStream open() throws IOException; }

    static void stage(File file, String text) throws IOException {
        if (text == null || text.trim().isEmpty()) throw new IOException("Backup content is empty.");
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IOException("Backup exceeds 64 MB.");
        File part = new File(file.getParentFile(), file.getName() + ".part");
        try {
            try (FileOutputStream out = new FileOutputStream(part)) {
                out.write(bytes); out.flush(); out.getFD().sync();
            }
            // renameTo is atomic within the app-private directory and works on API 24.
            if (!part.renameTo(file)) throw new IOException("Could not preserve backup content.");
        } finally { part.delete(); }
    }

    static long copyAndVerify(File source, OutputOpener output, InputOpener input) throws IOException {
        if (!source.isFile() || source.length() <= 0 || source.length() > MAX_BYTES) {
            throw new IOException("Backup content is missing. Create a new backup.");
        }
        MessageDigest expected = sha256();
        long written;
        try (InputStream from = new FileInputStream(source); OutputStream to = output.open()) {
            if (to == null) throw new IOException("Could not open backup destination.");
            written = transfer(from, to, expected);
            to.flush();
        }
        if (written != source.length() || written == 0) throw new IOException("Backup write was incomplete.");
        MessageDigest actual = sha256();
        long read;
        try (InputStream saved = input.open()) {
            if (saved == null) throw new IOException("Could not verify the saved backup.");
            read = transfer(saved, null, actual);
        }
        if (read != written || !MessageDigest.isEqual(expected.digest(), actual.digest())) {
            throw new IOException("The saved backup is empty or incomplete.");
        }
        return written;
    }
    private static long transfer(InputStream from, OutputStream to, MessageDigest digest) throws IOException {
        byte[] block = new byte[16384]; long size = 0; int count;
        while ((count = from.read(block)) != -1) {
            if (count == 0) continue;
            size += count;
            if (size > MAX_BYTES) throw new IOException("Backup exceeds 64 MB.");
            digest.update(block, 0, count);
            if (to != null) to.write(block, 0, count);
        }
        return size;
    }
    private static MessageDigest sha256() throws IOException {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IOException("Could not verify backup.", e); }
    }
}
