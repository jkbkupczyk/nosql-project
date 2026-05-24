export function processInterbankEvent(db, document) {
    const payload = document.payload;

    const paymentId = String(payload['message_id'])
    const status = payload['status']
    const setValue = getDefaultSetPipeline(paymentId, status, "interbank", document);

    const debtor = {};
    if (payload['debtor_account']) {
        debtor.account = payload['debtor_account'];
        setValue["debtor"] = debtor;
    }
    if (payload['debtor_name']) {
        debtor.name = payload['debtor_name'];
        setValue["debtor"] = debtor;
    }

    const creditor = {};
    if (payload['creditor_account']) {
        creditor.account = payload['creditor_account'];
        setValue["creditor"] = creditor;
    }
    if (payload['creditor_name']) {
        creditor.name = payload['creditor_name'];
        setValue["creditor"] = creditor;
    }

    const amount = Number(payload['amount']);
    if (payload['amount'] && !Number.isNaN(amount)) {
        setValue.amount = {
            $ifNull: ["$amount", amount]
        };
    }

    if (payload['currency']) {
        setValue['currency'] = {
            $ifNull: ["$currency", payload['currency']]
        };
    }

    if (payload['title']) {
        setValue['title'] = {
            $ifNull: ["$title", payload['title']]
        };
    }

    const interbankInfo = {}
    if (payload['session_date']) {
        interbankInfo.sessionDate = payload['session_date'];
        setValue["interbankInfo"] = interbankInfo;
    }
    if (payload['session_number']) {
        interbankInfo.sessionNumber = payload['session_number'];
        setValue["interbankInfo"] = interbankInfo;
    }

    return {
        paymentId: paymentId,
        setValue: setValue,
    };
}

export function processSwiftEvent(db, document) {
    const payload = document.payload;

    const paymentId = String(payload['txId']);
    const status = payload['status'];
    const setValue = getDefaultSetPipeline(paymentId, status, "swift", document);

    const debtor = {};
    if (payload['debtorAccount']?.['value']) {
        debtor.account = payload['debtorAccount']['value']
        setValue["debtor"] = debtor;
    }
    if (payload['debtorParty']) {
        debtor.name = getFullNameFromSwiftParty(payload['debtorParty']);
        setValue["debtor"] = debtor;
    }

    const creditor = {};
    if (payload['creditorAccount']?.['value']) {
        creditor.account = payload['creditorAccount']['value'];
        setValue["creditor"] = creditor;
    }
    if (payload['creditorParty']) {
        creditor.name = getFullNameFromSwiftParty(payload['creditorParty']);
        setValue["creditor"] = creditor;
    }

    if (payload['amount']?.['value']) {
        const amount = Number(payload['amount']['value']);
        if (amount && !Number.isNaN(amount)) {
            setValue.amount = {
                $ifNull: ["$amount", amount]
            };
        }
    }

    if (payload['amount']?.['currency']) {
        setValue['currency'] = {
            $ifNull: ["$currency", payload['amount']['currency']]
        };
    }

    if (payload['title']) {
        setValue['title'] = {
            $ifNull: ["$title", payload['title']]
        };
    }

    const swift = {}
    if (payload['debtorAgent']) {
        swift.debtorAgent = payload['debtorAgent'];
        setValue["swift"] = swift;
    }
    if (payload['creditorAgent']) {
        swift.creditorAgent = payload['creditorAgent'];
        setValue["swift"] = swift;
    }

    return {
        paymentId: paymentId,
        setValue: setValue,
    };
}

function getFullNameFromSwiftParty(party) {
    if (!party) {
        return '';
    }
    const parts = [
        party["name"], party["country"],
        party["city"], party["postcode"],
        party["street"], party["buildingNumber"]
    ]
    return parts.join(" ")
}

function getDefaultSetPipeline(paymentId, rawStatus, domain, document) {
    const statusValue = rawStatus ?? "INITIALIZED";
    return {
        paymentId: paymentId,
        domain: domain,
        currentStatus: statusValue,
        statusFlow: {
            $sortArray: {
                input: {
                    $concatArrays: [
                        {$ifNull: ["$statusFlow", []]},
                        [{
                            status: statusValue,
                            occurredAt: new Date(document.eventTimestamp)
                        }]
                    ]
                },
                sortBy: {
                    occurredAt: 1
                }
            }
        },
        events: {
            $concatArrays: [
                {$ifNull: ["$events", []]},
                [document.eventId]
            ]
        }
    }
}
