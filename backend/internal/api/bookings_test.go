package api_test

import (
	"context"
	"encoding/json"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBookingMissing(t *testing.T) {
	r := httptest.NewRecorder()
	api.NewRouterWithBookings(usecase.NewEvents(missingBooking{}, "Owner"), nil, usecase.NewBookings(missingBooking{}, domain.DefaultSchedule(), time.Now)).ServeHTTP(r, httptest.NewRequest("GET", "/api/bookings/00000000-0000-4000-8000-000000000000", nil))
	if r.Code != 404 {
		t.Fatalf("want404 got%d %s", r.Code, r.Body.String())
	}
}

type missingBooking struct{ missingEvents }

func (missingBooking) CreateBooking(context.Context, domain.Booking) error { return nil }
func (missingBooking) GetBooking(context.Context, string) (domain.Booking, error) {
	return domain.Booking{}, domain.ErrNotFound
}

type knownEventBooking struct{ missingEvents }

func (knownEventBooking) GetEvent(context.Context, string) (domain.EventType, error) {
	return domain.EventType{ID: "00000000-0000-4000-8000-000000000001", Name: "Meeting", DurationMinutes: 30}, nil
}
func (knownEventBooking) CreateBooking(context.Context, domain.Booking) error { return nil }
func (knownEventBooking) GetBooking(context.Context, string) (domain.Booking, error) {
	return domain.Booking{}, domain.ErrNotFound
}

func TestBookingSlotUnavailableMessageIsNeutral(t *testing.T) {
	now := time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC)
	bookings := usecase.NewBookings(knownEventBooking{}, domain.DefaultSchedule(), func() time.Time { return now })
	router := api.NewRouterWithBookings(usecase.NewEvents(missingEvents{}, "Owner"), nil, bookings)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/bookings", strings.NewReader(`{"eventTypeId":"00000000-0000-4000-8000-000000000001","startsAt":"2026-10-07T06:00:00Z","guestName":"Гость","guestEmail":"guest@example.com"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body generated.ErrorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	const neutral = "Это время больше недоступно для бронирования. Выберите другой слот"
	if body.Code != "SLOT_UNAVAILABLE" || body.Message != neutral {
		t.Fatalf("body=%+v", body)
	}
}
