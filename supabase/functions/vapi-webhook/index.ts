// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildFailureDiagnosticMessage(endedReason: string) {
  if (endedReason === "twilio-failed-to-connect-call") {
    return "Diagnostica: Twilio non ha connesso la chiamata (twilio-failed-to-connect-call). Controlla Voice Geo Permissions e limiti Trial/numero verificato.";
  }

  return `Diagnostica: chiamata terminata con motivo: ${endedReason}`;
}

async function appendFailureDiagnostic(
  supabase: any,
  callId: string,
  endedReason: string,
) {
  try {
    const content = buildFailureDiagnosticMessage(endedReason);

    const { data: prankData, error: prankError } = await supabase
      .from("pranks")
      .select("conversation_history")
      .eq("twilio_call_sid", callId)
      .maybeSingle();

    if (prankError) {
      console.error("Error fetching prank to append diagnostic:", prankError);
      return;
    }

    const currentHistory = Array.isArray(prankData?.conversation_history)
      ? (prankData?.conversation_history as unknown[])
      : [];

    const alreadyPresent = currentHistory.some((m: any) =>
      typeof m?.content === "string" && m.content.includes(content),
    );

    if (alreadyPresent) return;

    const updatedHistory = [
      ...currentHistory,
      {
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      },
    ];

    const { error: updateError } = await supabase
      .from("pranks")
      .update({ conversation_history: updatedHistory })
      .eq("twilio_call_sid", callId);

    if (updateError) {
      console.error("Error appending failure diagnostic:", updateError);
    } else {
      console.log("Failure diagnostic appended to conversation_history");
    }
  } catch (e) {
    console.error("appendFailureDiagnostic error:", e);
  }
}

// Helper function to update live transcript - supports both callId and prankId lookup
async function updateLiveTranscript(supabase: any, callId: string | null, prankId: string | null, role: string, transcript: string) {
  try {
    let prank = null;
    let prankError = null;
    
    // Try to find prank by prankId first (most reliable), then by callId
    if (prankId) {
      const result = await supabase
        .from("pranks")
        .select("id, conversation_history")
        .eq("id", prankId)
        .maybeSingle();
      prank = result.data;
      prankError = result.error;
    }
    
    if (!prank && callId) {
      const result = await supabase
        .from("pranks")
        .select("id, conversation_history")
        .eq("twilio_call_sid", callId)
        .maybeSingle();
      prank = result.data;
      prankError = result.error;
    }
    
    if (prank && !prankError) {
      const currentHistory = Array.isArray(prank.conversation_history) 
        ? prank.conversation_history 
        : [];
      
      const newMessage = {
        role: role === "bot" ? "assistant" : role,
        content: transcript,
        timestamp: new Date().toISOString()
      };
      
      const updatedHistory = [...currentHistory, newMessage];
      
      const { error: updateError } = await supabase
        .from("pranks")
        .update({ conversation_history: updatedHistory })
        .eq("id", prank.id);
      
      if (updateError) {
        console.error("Error updating live transcript:", updateError);
      } else {
        console.log("Live transcript updated, total messages:", updatedHistory.length);
      }
    } else {
      console.log("Prank not found for live transcript, callId:", callId, "prankId:", prankId);
    }
  } catch (e) {
    console.error("updateLiveTranscript error:", e);
  }
}

// Helper function to decrement current_calls and process queue
async function decrementCallerIdAndProcessQueue(supabase: any) {
  console.log("=== DECREMENTING CALLER ID AND PROCESSING QUEUE ===");

  // Find all caller IDs with current_calls > 0 and decrement one
  // We decrement based on which ones have active calls
  const { data: activeCallerIds } = await supabase
    .from("verified_caller_ids")
    .select("*")
    .gt("current_calls", 0)
    .order("current_calls", { ascending: false })
    .limit(1);

  if (activeCallerIds && activeCallerIds.length > 0) {
    const callerId = activeCallerIds[0];
    const newCount = Math.max(0, (callerId.current_calls || 1) - 1);

    await supabase
      .from("verified_caller_ids")
      .update({ current_calls: newCount })
      .eq("id", callerId.id);

    console.log(
      `Decremented caller ID ${callerId.phone_number}: ${callerId.current_calls} -> ${newCount}`,
    );
  }

  // Check if there are queued calls to process
  const { data: queuedCalls } = await supabase
    .from("call_queue")
    .select("*")
    .eq("status", "queued")
    .order("position", { ascending: true })
    .limit(1);

  if (queuedCalls && queuedCalls.length > 0) {
    const nextCall = queuedCalls[0];
    console.log("Found queued call to process:", nextCall.prank_id);

    // Check if there's now capacity
    const { data: availableCallerIds } = await supabase
      .from("verified_caller_ids")
      .select("*")
      .eq("is_active", true)
      .not("vapi_phone_number_id", "is", null);

    const hasCapacity = availableCallerIds?.some(
      (cid: any) => (cid.current_calls || 0) < (cid.max_concurrent_calls || 1),
    );

    if (hasCapacity) {
      console.log("Capacity available, triggering call for queued prank:", nextCall.prank_id);

      // Update queue status to processing
      await supabase
        .from("call_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", nextCall.id);

      // Trigger the call via edge function
      try {
        await supabase.functions.invoke("initiate-call-vapi", {
          body: { prankId: nextCall.prank_id },
        });

        // Mark queue entry as completed
        await supabase
          .from("call_queue")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", nextCall.id);

        console.log("Queued call initiated successfully");
      } catch (error) {
        console.error("Error initiating queued call:", error);
        // Revert to queued status on error
        await supabase.from("call_queue").update({ status: "queued" }).eq("id", nextCall.id);
      }
    } else {
      console.log("No capacity available yet for queued calls");
    }
  } else {
    console.log("No queued calls to process");
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log("=== VAPI WEBHOOK RECEIVED ===");
    console.log("Event type:", body.message?.type);
    console.log("Call ID:", body.message?.call?.id);
    
    // Extract prankId from metadata - CRITICAL for identifying prank before call ID is stored
    const metadataPrankId = body.message?.call?.metadata?.prankId;
    console.log("Metadata prankId:", metadataPrankId);
    console.log("Full payload:", JSON.stringify(body, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const messageType = body.message?.type;
    const callId = body.message?.call?.id;

    // Handle live transcript updates during the call
    // VAPI sends transcript in both "transcript" events and "status-update" events
    if (messageType === "transcript") {
      console.log("=== LIVE TRANSCRIPT EVENT ===");
      const transcript = body.message?.transcript;
      const role = body.message?.role; // "assistant" or "user"
      const transcriptType = body.message?.transcriptType; // "partial" or "final"
      
      console.log("Role:", role);
      console.log("Transcript type:", transcriptType);
      console.log("Transcript:", transcript);
      
      // Only process final transcripts to avoid duplicates
      if (transcriptType === "final" && transcript) {
        await updateLiveTranscript(supabase, callId, metadataPrankId, role, transcript);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle status-update events which contain artifact.messages for live transcript
    if (messageType === "status-update") {
      console.log("=== STATUS UPDATE EVENT ===");
      const status = body.message?.status;
      const artifactMessages = body.message?.artifact?.messages;
      
      console.log("Status:", status);
      console.log("Artifact messages count:", artifactMessages?.length || 0);
      
      // Find prank - try by prankId first (from metadata), then by callId
      let prank = null;
      let prankError = null;
      
      if (metadataPrankId) {
        const result = await supabase
          .from("pranks")
          .select("id, conversation_history, call_status")
          .eq("id", metadataPrankId)
          .maybeSingle();
        prank = result.data;
        prankError = result.error;
      }
      
      if (!prank && callId) {
        const result = await supabase
          .from("pranks")
          .select("id, conversation_history, call_status")
          .eq("twilio_call_sid", callId)
          .maybeSingle();
        prank = result.data;
        prankError = result.error;
      }
      
      // Update live transcript from artifact.messages if available
      if (prank && !prankError && artifactMessages && Array.isArray(artifactMessages) && artifactMessages.length > 0) {
        // Filter out system messages and convert to our format
        const conversationMessages = artifactMessages
          .filter((msg: any) => msg.role !== "system" && msg.role !== "tool-calls" && msg.role !== "tool-call-result")
          .map((msg: any) => ({
            role: msg.role === "bot" ? "assistant" : (msg.role === "assistant" ? "assistant" : "user"),
            content: msg.message || msg.content || "",
            timestamp: new Date().toISOString()
          }));
        
        if (conversationMessages.length > 0) {
          // CRITICAL: Don't overwrite terminal statuses (recording_available, completed, failed, etc.)
          // A status-update with "ended" can arrive AFTER end-of-call-report which already set recording_available
          const terminalStatuses = ["recording_available", "completed", "failed", "no_answer", "busy"];
          const isAlreadyTerminal = terminalStatuses.includes(prank.call_status);
          
          const updatePayload: any = { conversation_history: conversationMessages };
          
          if (!isAlreadyTerminal) {
            updatePayload.call_status = status === "in-progress" ? "in_progress" : 
                         status === "ended" ? "completed" : prank.call_status;
          }
          
          const { error: updateError } = await supabase
            .from("pranks")
            .update(updatePayload)
            .eq("id", prank.id);
          
          if (updateError) {
            console.error("Error updating from status-update:", updateError);
          } else {
            console.log("Updated from status-update, messages:", conversationMessages.length, "status preserved:", isAlreadyTerminal);
          }
        }
      } else if (!prank) {
        console.log("Prank not found for status-update, callId:", callId, "prankId:", metadataPrankId);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle conversation-update events for LIVE transcript updates during the call
    // This is the PRIMARY event for real-time transcript - VAPI sends these during active calls
    if (messageType === "conversation-update") {
      console.log("=== CONVERSATION UPDATE EVENT ===");
      const conversation = body.message?.conversation;
      
      console.log("Conversation messages count:", conversation?.length || 0);
      
      // Find prank - try by prankId first (from metadata), then by callId
      let prank = null;
      let prankError = null;
      
      if (metadataPrankId) {
        const result = await supabase
          .from("pranks")
          .select("id, conversation_history, call_status")
          .eq("id", metadataPrankId)
          .maybeSingle();
        prank = result.data;
        prankError = result.error;
      }
      
      if (!prank && callId) {
        const result = await supabase
          .from("pranks")
          .select("id, conversation_history, call_status")
          .eq("twilio_call_sid", callId)
          .maybeSingle();
        prank = result.data;
        prankError = result.error;
      }
      
      if (prank && !prankError && conversation && Array.isArray(conversation) && conversation.length > 0) {
        // Filter out system messages and convert to our format
        // VAPI sends timestamps in milliseconds, not seconds
        const conversationMessages = conversation
          .filter((msg: any) => msg.role !== "system" && msg.role !== "tool-calls" && msg.role !== "tool-call-result")
          .map((msg: any) => ({
            role: msg.role === "bot" ? "assistant" : (msg.role === "assistant" ? "assistant" : "user"),
            content: msg.message || msg.content || "",
            timestamp: new Date().toISOString() // Use current time for live messages
          }));
        
        if (conversationMessages.length > 0) {
          const { error: updateError } = await supabase
            .from("pranks")
            .update({ 
              conversation_history: conversationMessages,
              call_status: "in_progress" // Ensure status is updated when we receive conversation
            })
            .eq("id", prank.id);
          
          if (updateError) {
            console.error("Error updating from conversation-update:", updateError);
          } else {
            console.log("LIVE transcript updated from conversation-update, messages:", conversationMessages.length);
          }
        }
      } else if (!prank) {
        console.log("Prank not found for conversation-update, callId:", callId, "prankId:", metadataPrankId);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Handle end-of-call-report which contains recording URL and call duration
    if (messageType === "end-of-call-report") {
      console.log("=== END OF CALL REPORT ===");
      const reportCallId = body.message?.call?.id;
      // Recording URL can be in multiple locations depending on VAPI version
      const recordingUrl = body.message?.recordingUrl 
        || body.message?.artifact?.recordingUrl
        || body.message?.artifact?.recording?.url
        || body.message?.call?.recordingUrl;
      const endedReason = body.message?.endedReason || body.message?.call?.endedReason;
      
      // Get call duration in seconds - use ?? to handle 0 correctly, and fallback to timestamp calculation
      let durationSeconds = body.message?.durationSeconds 
        ?? body.message?.call?.duration
        ?? body.message?.artifact?.duration
        ?? null;
      
      // If no explicit duration, calculate from call timestamps
      if (durationSeconds === null || durationSeconds === undefined) {
        const callStartedAt = body.message?.call?.startedAt || body.message?.startedAt;
        const callEndedAt = body.message?.call?.endedAt || body.message?.endedAt;
        if (callStartedAt && callEndedAt) {
          durationSeconds = (new Date(callEndedAt).getTime() - new Date(callStartedAt).getTime()) / 1000;
          console.log(`Duration calculated from timestamps: ${durationSeconds}s (${callStartedAt} -> ${callEndedAt})`);
        } else {
          durationSeconds = 0;
        }
      }
      
      console.log("=== DURATION DEBUG ===");
      console.log("body.message.durationSeconds:", body.message?.durationSeconds);
      console.log("body.message.call.duration:", body.message?.call?.duration);
      console.log("body.message.artifact.duration:", body.message?.artifact?.duration);
      console.log("Final durationSeconds:", durationSeconds);
      
      // Get conversation transcript from artifact - VAPI can send it in multiple places
      // Try artifact.messages first, then fall back to other possible locations
      const artifact = body.message?.artifact;
      const artifactMessages = artifact?.messages 
        || body.message?.messages 
        || body.message?.call?.artifact?.messages;
      
      // Also get the full transcript string if available
      const fullTranscript = artifact?.transcript || body.message?.transcript;
      
      console.log("=== ARTIFACT DEBUG ===");
      console.log("Artifact exists:", !!artifact);
      console.log("Artifact keys:", artifact ? Object.keys(artifact) : "N/A");
      console.log("Artifact messages:", artifactMessages?.length || 0);
      console.log("Full transcript:", fullTranscript ? fullTranscript.substring(0, 200) + "..." : "N/A");
      if (artifactMessages && artifactMessages.length > 0) {
        console.log("First message sample:", JSON.stringify(artifactMessages[0]));
      }
      
      // Check if call was answered (customer picked up)
      const wasAnswered = endedReason !== "customer-did-not-answer" 
        && endedReason !== "no-answer"
        && endedReason !== "customer-busy"
        && endedReason !== "busy";
      
      const isFailed = endedReason?.includes("error") || endedReason?.includes("failed");
      
      console.log("Report Call ID:", reportCallId);
      console.log("Recording URL:", recordingUrl);
      console.log("Ended Reason:", endedReason);
      console.log("Duration (seconds):", durationSeconds);
      console.log("Was Answered:", wasAnswered);
      console.log("Is Failed:", isFailed);
      
      if (reportCallId) {
        let newStatus = "completed";
        if (recordingUrl) {
          newStatus = "recording_available";
        } else if (endedReason === "customer-did-not-answer" || endedReason === "no-answer") {
          newStatus = "no_answer";
        } else if (endedReason === "customer-busy" || endedReason === "busy") {
          newStatus = "busy";
        } else if (isFailed) {
          newStatus = "failed";
        }
        
        const updateData: { call_status: string; recording_url?: string; conversation_history?: unknown[] } = {
          call_status: newStatus,
        };
        
        if (recordingUrl) {
          updateData.recording_url = recordingUrl;
        }
        
        // Save conversation history from artifact messages if available
        if (artifactMessages && Array.isArray(artifactMessages) && artifactMessages.length > 0) {
          const conversationHistory = artifactMessages
            .filter((msg: any) => msg.role !== "system" && msg.role !== "tool-calls" && msg.role !== "tool-call-result")
            .map((msg: any) => ({
              role: msg.role === "bot" ? "assistant" : (msg.role === "assistant" ? "assistant" : "user"),
              content: msg.message || msg.content || "",
              timestamp: new Date().toISOString() // Use current time to avoid VAPI timestamp issues
            }));
          
          if (conversationHistory.length > 0) {
            updateData.conversation_history = conversationHistory;
            console.log("Saving conversation history with", conversationHistory.length, "messages");
          }
        }
        
        const { error } = await supabase
          .from("pranks")
          .update(updateData)
          .eq("twilio_call_sid", reportCallId);

        if (error) {
          console.error("Error updating prank from end-of-call-report:", error);
        } else {
          console.log("Prank updated from end-of-call-report:", newStatus);

          if (newStatus === "failed" && typeof endedReason === "string" && endedReason) {
            await appendFailureDiagnostic(supabase, reportCallId, endedReason);
          }
        }

        // === DECREMENT CURRENT_CALLS AND PROCESS QUEUE ===
        await decrementCallerIdAndProcessQueue(supabase);
        
        // === PRANK CONSUMPTION LOGIC ===
        // Fetch prank to get user_id
        const { data: prankData } = await supabase
          .from("pranks")
          .select("user_id")
          .eq("twilio_call_sid", reportCallId)
          .maybeSingle();
        
        if (prankData?.user_id) {
          // Fetch consumption settings
          const { data: settings } = await supabase
            .from("app_settings")
            .select("key, value")
            .in("key", ["prank_min_duration", "prank_require_answered", "prank_count_failed"]);
          
          // Parse settings with defaults
          let minDuration = 30;
          let requireAnswered = true;
          let countFailed = false;
          
          settings?.forEach((s: { key: string; value: string }) => {
            if (s.key === "prank_min_duration") minDuration = parseInt(s.value) || 30;
            if (s.key === "prank_require_answered") requireAnswered = s.value === "true";
            if (s.key === "prank_count_failed") countFailed = s.value === "true";
          });
          
          console.log("=== CONSUMPTION RULES ===");
          console.log("Min Duration:", minDuration, "| Require Answered:", requireAnswered, "| Count Failed:", countFailed);
          
          // Determine if prank should be consumed
          let shouldConsume = true;
          
          // Check if call was answered (if required)
          if (requireAnswered && !wasAnswered) {
            console.log("Prank NOT consumed: call was not answered");
            shouldConsume = false;
          }
          
          // Check duration
          if (shouldConsume && minDuration > 0 && durationSeconds < minDuration) {
            console.log(`Prank NOT consumed: duration ${durationSeconds}s < minimum ${minDuration}s`);
            shouldConsume = false;
          }
          
          // Check if failed calls should be excluded
          if (shouldConsume && isFailed && !countFailed) {
            console.log("Prank NOT consumed: call failed and countFailed is disabled");
            shouldConsume = false;
          }
          
          // Decrement available_pranks if rules are satisfied
          if (shouldConsume) {
            console.log("=== CONSUMING PRANK ===");
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("available_pranks")
              .eq("user_id", prankData.user_id)
              .maybeSingle();
            
            if (profile && !profileError) {
              const currentPranks = profile.available_pranks || 0;
              const newPranks = Math.max(0, currentPranks - 1);
              
              const { error: updateError } = await supabase
                .from("profiles")
                .update({ available_pranks: newPranks })
                .eq("user_id", prankData.user_id);
              
              if (updateError) {
                console.error("Error decrementing pranks:", updateError);
              } else {
                console.log(`Pranks decremented: ${currentPranks} -> ${newPranks}`);
              }
            }
          }
          
          // Schedule reveal SMS 1 minute after call end (only if call lasted >= 30 seconds)
          const REVEAL_SMS_MIN_DURATION = 30;
          const shouldScheduleRevealSms = wasAnswered && !isFailed && durationSeconds >= REVEAL_SMS_MIN_DURATION;
          
          if (shouldScheduleRevealSms) {
            const scheduledAt = new Date(Date.now() + 1 * 60 * 1000).toISOString();
            console.log(`=== SCHEDULING REVEAL SMS for ${scheduledAt} (duration ${durationSeconds}s >= ${REVEAL_SMS_MIN_DURATION}s) ===`);
            const { error: scheduleError } = await supabase
              .from("pranks")
              .update({ reveal_sms_scheduled_at: scheduledAt })
              .eq("twilio_call_sid", reportCallId);
            if (scheduleError) {
              console.error("Error scheduling reveal SMS:", scheduleError);
            } else {
              console.log("Reveal SMS scheduled successfully for 1 minute from now");
            }
          } else {
            console.log(`=== SKIPPING REVEAL SMS: answered=${wasAnswered}, failed=${isFailed}, duration=${durationSeconds}s (min ${REVEAL_SMS_MIN_DURATION}s) ===`);
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callId) {
      console.log("No call ID in webhook, skipping");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map VAPI status to our call_status
    let newStatus: string | null = null;
    let recordingUrl: string | null = null;
    let endedReasonForDiagnostic: string | null = null;

    switch (messageType) {
      case "status-update":
        const status = body.message?.status;
        console.log("Status update:", status);
        if (status === "ringing") {
          newStatus = "ringing";
        } else if (status === "in-progress") {
          newStatus = "in_progress";
        } else if (status === "ended") {
          newStatus = "completed";
        }
        break;
        
      case "call-started":
        newStatus = "in_progress";
        break;
      case "call-ringing":
        newStatus = "ringing";
        break;
      case "call-answered":
        newStatus = "in_progress";
        break;
      case "call-ended":
        // Check end reason
        const endReason = body.message?.call?.endedReason;
        console.log("Call ended reason:", endReason);

        if (typeof endReason === "string") {
          endedReasonForDiagnostic = endReason;
        }
        
        if (endReason === "customer-did-not-answer" || endReason === "no-answer") {
          newStatus = "no_answer";
        } else if (endReason === "customer-busy" || endReason === "busy") {
          newStatus = "busy";
        } else if (endReason === "customer-ended-call" || endReason === "assistant-ended-call" || endReason === "max-duration-reached") {
          newStatus = "completed";
        } else if (endReason?.includes("error") || endReason?.includes("failed")) {
          newStatus = "failed";
        } else {
          newStatus = "completed";
        }

        // Check for recording URL in call-ended event
        recordingUrl = body.message?.call?.recordingUrl || body.message?.call?.artifact?.recordingUrl;
        if (recordingUrl) {
          console.log("Recording URL found in call-ended:", recordingUrl);
          newStatus = "recording_available";
        }
        break;

      case "transcript":
        // Already handled above (lines 242-260) - skip duplicate processing
        console.log("Transcript event already handled above, skipping switch case");
        break;
        
      case "conversation-update":
        // Already handled above (lines 335-398) - skip duplicate processing
        console.log("Conversation-update event already handled above, skipping switch case");
        break;

      case "speech-update":
      case "function-call":
      case "tool-calls":
        // These are informational, don't update status
        console.log("Informational event, no status update");
        break;

      default:
        console.log("Unknown event type:", messageType);
    }

    // Update the prank in the database if we have a status change
    if (newStatus) {
      console.log(`Updating prank with VAPI call ID ${callId} to status: ${newStatus}`);
      
      // CRITICAL: Don't overwrite terminal statuses set by end-of-call-report
      // (e.g., recording_available should not be overwritten by a late call-ended event)
      const { data: currentPrank } = await supabase
        .from("pranks")
        .select("call_status")
        .eq("twilio_call_sid", callId)
        .maybeSingle();
      
      const terminalStatuses = ["recording_available", "completed", "failed", "no_answer", "busy"];
      if (currentPrank && terminalStatuses.includes(currentPrank.call_status)) {
        console.log(`Skipping status update: prank already in terminal status "${currentPrank.call_status}"`);
      } else {
        const updateData: { call_status: string; recording_url?: string } = {
          call_status: newStatus,
        };
        
        if (recordingUrl) {
          updateData.recording_url = recordingUrl;
        }

        const { data, error } = await supabase
          .from("pranks")
          .update(updateData)
          .eq("twilio_call_sid", callId);

        if (error) {
          console.error("Error updating prank:", error);
        } else {
          console.log("Prank updated successfully");

          if (newStatus === "failed" && endedReasonForDiagnostic && typeof callId === "string") {
            await appendFailureDiagnostic(supabase, callId, endedReasonForDiagnostic);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
