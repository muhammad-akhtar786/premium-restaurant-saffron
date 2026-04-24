(function () {
  const form = document.getElementById("reservationForm");
  const successPanel = document.getElementById("reservationSuccess");
  const modeLabel = document.getElementById("reservationModeLabel");

  function setModeLabel() {
    if (!modeLabel || !window.SaffronStore) {
      return;
    }

    modeLabel.textContent = window.SaffronStore.isDemoMode()
      ? "Demo mode: reservations save in this browser"
      : "Connected to Firebase Firestore";
  }

  function getFormValue(name) {
    return form?.elements[name]?.value.trim() || "";
  }

  async function handleReservationSubmit(event) {
    event.preventDefault();

    if (!window.SaffronStore) {
      return;
    }

    const reservation = {
      customerName: getFormValue("customerName"),
      phone: getFormValue("phone"),
      email: getFormValue("email"),
      date: getFormValue("date"),
      time: getFormValue("time"),
      guests: getFormValue("guests"),
      note: getFormValue("note"),
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    if (!reservation.customerName || !reservation.phone || !reservation.date || !reservation.time || !reservation.guests) {
      if (typeof showToast === "function") {
        showToast("Please complete the required reservation details");
      }
      return;
    }

    const savedReservation = await window.SaffronStore.saveReservation(reservation);
    form.reset();

    if (successPanel) {
      successPanel.hidden = false;
      successPanel.querySelector("[data-reservation-id]").textContent = savedReservation.id;
      successPanel.querySelector("[data-reservation-time]").textContent = `${savedReservation.date} at ${savedReservation.time}`;
    }

    if (typeof showToast === "function") {
      showToast("Reservation request received", {
        meta: "Your table request is now visible in the admin dashboard."
      });
    }
  }

  if (form) {
    form.addEventListener("submit", handleReservationSubmit);
  }

  setModeLabel();
  window.addEventListener("saffron-store-ready", setModeLabel);
})();
