package com.keithfell.noted.personal;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

/** Uses the on-device service only. No fallback to a network recognizer. */
@CapacitorPlugin(name = "NotedSpeech", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class NotedSpeechPlugin extends Plugin implements RecognitionListener {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall pending;
    private final Runnable timeout = () -> fail("Dictation timed out. Try a shorter entry.");

    @PluginMethod
    public void listen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Dictation is already running."); return; }
            pending = call;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                requestPermissionForAlias("microphone", call, "permissionResult");
            } else begin();
        });
    }
    @PermissionCallback
    private void permissionResult(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending != call) return;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                fail("Microphone permission is needed. Allow it in Android settings, or type instead.");
            } else begin();
        });
    }
    private void begin() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
            fail("On-device speech is unavailable. Install or enable your phone's speech recognition and language pack, or use keyboard dictation.");
            return;
        }
        try {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            handler.postDelayed(timeout, 60000);
            recognizer.startListening(intent);
        } catch (Exception e) { fail("Could not start on-device dictation. Try keyboard dictation instead."); }
    }
    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }
    @PluginMethod
    public void cancel(PluginCall call) {
        getActivity().runOnUiThread(() -> { fail("Dictation canceled."); call.resolve(); });
    }
    private void fail(String message) {
        PluginCall call = pending;
        pending = null;
        cleanup();
        if (call != null) call.reject(message);
    }
    private void cleanup() {
        handler.removeCallbacks(timeout);
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
    }
    @Override public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        PluginCall call = pending;
        pending = null;
        cleanup();
        if (call != null) {
            JSObject result = new JSObject();
            result.put("text", matches == null || matches.isEmpty() ? "" : matches.get(0));
            call.resolve(result);
        }
    }
    @Override public void onError(int error) {
        String message;
        switch (error) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                message = "Allow microphone access in Android settings, or type instead."; break;
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                message = "This speech language isn't installed or supported on-device. Download it in your phone's speech settings, or type instead."; break;
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                message = "No speech detected. Try again or type your entry."; break;
            default: message = "On-device dictation couldn't finish. Try again or use keyboard dictation.";
        }
        fail(message);
    }
    @Override protected void handleOnPause() {
        super.handleOnPause();
        // Keep the permission request alive; only cancel an active recognizer.
        if (recognizer != null) getActivity().runOnUiThread(() -> fail("Dictation stopped when Noted went into the background."));
    }
    @Override protected void handleOnDestroy() { fail("Dictation canceled."); super.handleOnDestroy(); }
    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle results) {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
