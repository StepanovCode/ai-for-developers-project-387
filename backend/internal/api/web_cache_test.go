package api_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
)

func TestWebCachePolicy(t *testing.T) {
	dir := t.TempDir()
	modified := time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC)
	for name, contents := range map[string]string{
		"index.html":                    "<!doctype html><title>Meetly</title>",
		"assets/index-B7x9k2Lm.js":      "console.log('Meetly')",
		"assets/index-B7x9k2Lm.css":     "body { color: black; }",
		"assets/manrope-B7x9k2Lm.woff2": "font fixture",
		"logo.svg":                      "<svg></svg>",
	} {
		name := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(name), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(name, []byte(contents), 0600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(name, modified, modified); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := api.NewWebHandler(api.NewRouter(), dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name, method, path string
		conditional        bool
		status             int
		cacheControl       string
	}{
		{"javascript", "GET", "/assets/index-B7x9k2Lm.js", false, 200, "public, max-age=31536000, immutable"},
		{"stylesheet", "GET", "/assets/index-B7x9k2Lm.css", false, 200, "public, max-age=31536000, immutable"},
		{"font", "GET", "/assets/manrope-B7x9k2Lm.woff2", false, 200, "public, max-age=31536000, immutable"},
		{"head", "HEAD", "/assets/index-B7x9k2Lm.js", false, 200, "public, max-age=31536000, immutable"},
		{"not modified", "GET", "/assets/index-B7x9k2Lm.js", true, 304, "public, max-age=31536000, immutable"},
		{"home", "GET", "/", false, 200, "no-cache"},
		{"index", "GET", "/index.html", false, 200, "no-cache"},
		{"direct link", "GET", "/book/123?date=2026-10-20", false, 200, "no-cache"},
		{"missing asset", "GET", "/assets/missing-B7x9k2Lm.js", false, 404, ""},
		{"unversioned logo", "GET", "/logo.svg", false, 200, ""},
		{"api", "GET", "/api/health", false, 200, ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.conditional {
				request.Header.Set("If-Modified-Since", modified.Format(http.TimeFormat))
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tt.status {
				t.Fatalf("status=%d, want %d; body=%s", response.Code, tt.status, response.Body.String())
			}
			cacheControl := response.Header().Get("Cache-Control")
			if tt.cacheControl != "" && cacheControl != tt.cacheControl {
				t.Errorf("Cache-Control=%q, want %q", cacheControl, tt.cacheControl)
			}
			if tt.cacheControl == "" && strings.Contains(cacheControl, "immutable") {
				t.Errorf("immutable cache applied outside a successful asset response: %q", cacheControl)
			}
			if (tt.method == "HEAD" || tt.status == http.StatusNotModified) && response.Body.Len() != 0 {
				t.Fatal("body returned for HEAD or 304")
			}
		})
	}
}
