package handlers

import (
	"fmt"
	"net/url"
	"strings"
)

// NormalizeURL validates and normalizes a raw URL string.
// - If the scheme is missing, https:// is prepended.
// - Only http and https schemes are allowed.
// - Returns the normalized URL string or an error describing the problem.
func NormalizeURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("url is required")
	}
	// Add default scheme when missing.
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid url: %v", err)
	}
	if u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid url: missing host or scheme")
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		// allowed
	default:
		return "", fmt.Errorf("unsupported url scheme: %s", u.Scheme)
	}
	return u.String(), nil
}


Idm talking loads teaching
Overwhelming - not really. It's what I need

