package com.keithfell.noted.personal;

/** JSON represents epoch milliseconds as Long on Android, not always Double. */
final class CalendarTimes {
    private CalendarTimes() {}
    private static long millis(Object value) {
        if (!(value instanceof Number)) throw new IllegalArgumentException("Missing calendar time");
        double time = ((Number) value).doubleValue();
        if (!Double.isFinite(time) || Math.abs(time) > 8640000000000000L || time != Math.rint(time))
            throw new IllegalArgumentException("Invalid calendar time");
        return ((Number) value).longValue();
    }
    static long[] range(Object begin, Object finish) {
        long start = millis(begin), end = millis(finish);
        if (end <= start) throw new IllegalArgumentException("Invalid calendar range");
        return new long[] { start, end };
    }
}
