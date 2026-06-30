# ReGo State Machines

## Booking lifecycle

States:
- draft
- quote_ready
- pending_confirmation
- confirmed
- assigned
- en_route
- arrived
- in_progress
- approval_required
- completed
- report_submitted
- invoice_ready
- paid
- canceled
- expired
- disputed
- refunded

Allowed transitions:
- draft -> quote_ready when vehicle, address, service, fulfillment, provider/slot, and estimate state are valid.
- quote_ready -> pending_confirmation when customer confirms.
- pending_confirmation -> confirmed when provider/shop/dealer accepts.
- pending_confirmation -> expired if provider confirmation SLA is missed.
- confirmed -> assigned when provider/job assignment is locked.
- assigned -> en_route for mobile fulfillment.
- assigned -> arrived/checked_in for shop/dealer fulfillment.
- en_route -> arrived -> in_progress -> completed.
- in_progress -> approval_required when scope/price changes.
- approval_required -> in_progress if customer approves.
- approval_required -> canceled or completed_partial if customer declines.
- completed -> report_submitted -> invoice_ready -> paid.
- Any pre-completion state -> canceled subject to policy.
- Any post-completion state -> disputed/refunded through support/admin.

Transition audit fields:
- transitionId
- bookingId
- actorType
- actorId
- oldState
- newState
- reasonCode
- note
- createdAt

## Booking draft state

Draft fields:
- customerId or guestSessionId
- vehicleId
- serviceId
- fulfillmentType
- oilPreferenceId, only for oil-change
- providerId
- availabilitySlotId
- addressId
- estimateId

Guard rules:
- Oil preference required only when selected service requires oil/parts preference.
- Provider must support selected service, fulfillment, vehicle, market, and slot.
- Estimate must be current for selected inputs.
- Stale provider slot invalidates quote_ready.

## Job lifecycle

States:
- offered
- accepted
- declined
- assigned
- parts_check_required
- parts_confirmed
- en_route
- arrived
- started
- blocked
- customer_approval_required
- completed
- report_submitted
- closed
- canceled

Rules:
- Provider cannot mark en_route before accepting.
- Provider cannot complete before started.
- Report submission is required before closed.
- Dispatcher can reassign before en_route unless policy override exists.
