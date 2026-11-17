package com.keithfell.noted.personal;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

public class BackupTransferTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    private File staged(String text) throws IOException {
        File source = new File(folder.getRoot(), "pending.json");
        BackupTransfer.stage(source, text); return source;
    }
    @Test public void completeUtf8BackupSurvivesReopeningAndIsVerified() throws Exception {
        String text = "{\"format\":\"noted-personal\",\"payload\":\"María — photos and notes\"}";
        File source = staged(text), target = new File(folder.getRoot(), "backup.json");
        // Reopen using the persisted file, without retaining the original activity/call text.
        long size = BackupTransfer.copyAndVerify(new File(source.getPath()), () -> new FileOutputStream(target), () -> new FileInputStream(target));
        assertTrue(size > 0); assertEquals(text.getBytes(StandardCharsets.UTF_8).length, size);
        assertArrayEquals(Files.readAllBytes(source.toPath()), Files.readAllBytes(target.toPath()));
    }
    @Test public void providerSilentlyWritingZeroBytesCannotReportSuccess() throws Exception {
        File source = staged("{\"payload\":\"customer and pictures\"}");
        try {
            BackupTransfer.copyAndVerify(source, () -> new OutputStream(){ public void write(int b){} }, () -> new ByteArrayInputStream(new byte[0]));
            fail("An empty destination must be rejected");
        } catch (IOException expected) { assertTrue(expected.getMessage().contains("empty or incomplete")); }
    }
    @Test public void truncatedOrChangedDestinationIsRejected() throws Exception {
        File source = staged("{\"payload\":\"customer and pictures\"}");
        try {
            BackupTransfer.copyAndVerify(source, ByteArrayOutputStream::new, () -> new ByteArrayInputStream("{\"payload\":".getBytes(StandardCharsets.UTF_8)));
            fail("A truncated destination must be rejected");
        } catch (IOException expected) { assertTrue(expected.getMessage().contains("incomplete")); }
        byte[] changed = Files.readAllBytes(source.toPath()); changed[5] = 'X';
        try {
            BackupTransfer.copyAndVerify(source, ByteArrayOutputStream::new, () -> new ByteArrayInputStream(changed));
            fail("Same-size corruption must be rejected");
        } catch (IOException expected) { assertTrue(expected.getMessage().contains("incomplete")); }
    }
    @Test public void missingOrEmptyStagingNeverOpensDestination() throws Exception {
        AtomicBoolean opened = new AtomicBoolean();
        for (File source : new File[]{new File(folder.getRoot(), "missing"), folder.newFile("empty")}) {
            try {
                BackupTransfer.copyAndVerify(source, () -> {opened.set(true); return new ByteArrayOutputStream();}, () -> new ByteArrayInputStream(new byte[0]));
                fail("Missing source must be rejected");
            } catch (IOException expected) { assertFalse(opened.get()); }
        }
        try { staged(" "); fail("Empty staging must be rejected"); } catch (IOException expected) { assertTrue(expected.getMessage().contains("empty")); }
    }
    @Test public void closeFailureCannotReportSuccess() throws Exception {
        File source=staged("{\"payload\":\"data\"}");
        try {
            BackupTransfer.copyAndVerify(source, () -> new ByteArrayOutputStream(){public void close() throws IOException {throw new IOException("Disk full");}}, () -> new ByteArrayInputStream(new byte[0]));
            fail("Close failure must be propagated");
        } catch (IOException expected) { assertEquals("Disk full", expected.getMessage()); }
    }
}
