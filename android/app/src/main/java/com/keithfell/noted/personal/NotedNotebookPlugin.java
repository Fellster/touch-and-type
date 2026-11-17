package com.keithfell.noted.personal;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** App-private, transactional SQLite; file transfers only through Android's user-selected document picker. */
@CapacitorPlugin(name = "NotedNotebook")
public class NotedNotebookPlugin extends Plugin {
    private static final int MAX_BYTES = 64 * 1024 * 1024;
    private SQLiteDatabase db;
    private synchronized SQLiteDatabase database() {
        if (db == null) {
            db = getContext().openOrCreateDatabase("noted-personal.db", 0, null);
            db.execSQL("CREATE TABLE IF NOT EXISTS notebook (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, payload TEXT NOT NULL)");
        }
        return db;
    }
    @PluginMethod public synchronized void load(PluginCall call) {
        try (Cursor cursor = database().rawQuery("SELECT revision, payload FROM notebook WHERE id = 1", null)) {
            JSObject result = new JSObject();
            if (cursor.moveToFirst()) {
                result.put("revision", cursor.getInt(0)); result.put("payload", cursor.getString(1));
            } else { result.put("revision", 0); result.put("payload", JSONObject.NULL); }
            call.resolve(result);
        } catch (Exception e) { call.reject("Could not open your notebook. Do not uninstall Noted; try restarting the phone."); }
    }
    @PluginMethod public synchronized void save(PluginCall call) {
        String payload = call.getString("payload");
        Integer expected = call.getInt("revision");
        if (payload == null || expected == null || payload.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            call.reject("Notebook exceeds the storage limit or is invalid. No records were changed."); return;
        }
        SQLiteDatabase sql = null;
        boolean transaction = false;
        try {
            JSONObject parsed = new JSONObject(payload);
            parsed.getJSONArray("customers"); parsed.getJSONArray("todos"); parsed.getJSONArray("media"); parsed.getJSONObject("settings");
            sql = database(); sql.beginTransaction(); transaction = true;
            int revision = 0;
            try (Cursor cursor = sql.rawQuery("SELECT revision FROM notebook WHERE id = 1", null)) {
                if (cursor.moveToFirst()) revision = cursor.getInt(0);
            }
            if (revision != expected) throw new IllegalStateException("Another copy changed this notebook. Reopen it before saving.");
            ContentValues values = new ContentValues();
            values.put("id", 1); values.put("revision", revision + 1); values.put("payload", payload);
            if (sql.insertWithOnConflict("notebook", null, values, SQLiteDatabase.CONFLICT_REPLACE) == -1) throw new Exception("Could not save");
            sql.setTransactionSuccessful();
            // Commit before reporting success to the UI.
            sql.endTransaction(); transaction = false;
            JSObject result = new JSObject(); result.put("revision", revision + 1); call.resolve(result);
        } catch (Exception e) {
            call.reject(e instanceof IllegalStateException ? e.getMessage() : "Could not save. Check available phone storage. Your previous notebook is preserved.");
        } finally { if (transaction && sql != null) sql.endTransaction(); }
    }
    @PluginMethod public void exportFile(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) { call.reject("Backup is too large."); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Noted-Personal.json"));
        startActivityForResult(call, intent, "exportResult");
    }
    @ActivityCallback private void exportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { call.reject("Canceled"); return; }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) throw new Exception();
            stream.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8)); stream.flush();
        } catch (Exception e) { call.reject("Could not write backup. Choose another location and try again."); return; }
        call.resolve();
    }
    @PluginMethod public void importFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        startActivityForResult(call, intent, "importResult");
    }
    @ActivityCallback private void importResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { call.reject("Canceled"); return; }
        try (InputStream stream = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            if (stream == null) throw new Exception();
            byte[] block = new byte[16384]; int count;
            while ((count = stream.read(block)) != -1) {
                if (buffer.size() + count > MAX_BYTES) throw new Exception();
                buffer.write(block, 0, count);
            }
            JSObject data = new JSObject(); data.put("text", buffer.toString("UTF-8")); call.resolve(data);
        } catch (Exception e) { call.reject("Could not read backup. The file may be too large or inaccessible. Your notebook is unchanged."); }
    }
    @Override protected synchronized void handleOnDestroy() {
        if (db != null) { db.close(); db = null; }
        super.handleOnDestroy();
    }
}
