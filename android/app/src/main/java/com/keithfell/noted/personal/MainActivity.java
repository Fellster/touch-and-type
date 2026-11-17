package com.keithfell.noted.personal;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(NotedSpeechPlugin.class);
        registerPlugin(NotedNotebookPlugin.class);
        super.onCreate(state);
    }
}
