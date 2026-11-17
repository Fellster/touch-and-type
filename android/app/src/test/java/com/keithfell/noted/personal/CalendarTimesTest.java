package com.keithfell.noted.personal;

import org.junit.Test;
import static org.junit.Assert.*;

public class CalendarTimesTest {
    @Test public void androidJsonLongTimestampsPreserveTheScheduledTime() {
        // Epoch milliseconds decoded from the JS bridge are Long, which PluginCall.getDouble rejects.
        Long start = 1797548340000L;
        assertArrayEquals(new long[] {start, start + 1800000L}, CalendarTimes.range(start, start + 1800000L));
    }
    @Test public void alsoAcceptsFloatingPointAndIntegerJsonNumbers() {
        assertArrayEquals(new long[] {1797548340000L, 1797550140000L}, CalendarTimes.range(1797548340000.0, 1797550140000.0));
        assertArrayEquals(new long[] {1000, 2000}, CalendarTimes.range(1000, 2000));
    }
    @Test public void rejectsMissingMalformedOrInvalidDatesAndRanges() {
        for (Object start : new Object[] {null, "1797548340000", Double.NaN, Double.POSITIVE_INFINITY, 1.5, 8640000000000001L}) {
            try { CalendarTimes.range(start, 1797550140000L); fail("Accepted invalid start: " + start); }
            catch (IllegalArgumentException expected) {}
        }
        try { CalendarTimes.range(2000L, 1000L); fail("Accepted backwards range"); }
        catch (IllegalArgumentException expected) {}
        try { CalendarTimes.range(1000L, 1000L); fail("Accepted zero duration"); }
        catch (IllegalArgumentException expected) {}
    }
}
