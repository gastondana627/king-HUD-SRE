import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { triggerRemediationWebhook } from '../services/auditService';
import { Terminal, ShieldCheck, Server } from 'lucide-react';

export const RemediationHandler = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState("VALIDATING_TOKEN");

    useEffect(() => {
        const instance = searchParams.get('instance') || 'UNKNOWN';
        const token = searchParams.get('token') || '';
        const source = searchParams.get('source') || 'BLUE_TEAM_OOB_LINK';
        const claudeMatch = searchParams.get('claudeMatch') === 'true';
        const metricsRaw = searchParams.get('metrics');

        let metrics = undefined;
        if (metricsRaw) {
            try {
                metrics = JSON.parse(decodeURIComponent(metricsRaw));
            } catch (e) {
                console.warn("Failed to parse metrics from URL");
            }
        }

        setTimeout(() => {
            setStatus("EXECUTING_REMEDIATION_PROTOCOL");
            
            // Execute the webhook logic which logs the audit entry
            triggerRemediationWebhook(instance, token, source, metrics, claudeMatch);

            setTimeout(() => {
                setStatus("REBOOT_SUCCESSFUL_REDIRECTING");
                
                // Redirect back to dashboard after delay
                setTimeout(() => {
                    navigate('/');
                    // Force reload to reset state if needed, but navigate typically unmounts dashboard
                    window.location.reload(); 
                }, 2000);
            }, 1500);
        }, 1000);
    }, []);

    return (
        <div className="min-h-screen bg-black text-emerald-500 font-mono flex flex-col items-center justify-center p-4">
            <div className="max-w-lg w-full border border-emerald-500/30 bg-gray-900/80 p-8 rounded shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-[scan_2s_linear_infinite]"></div>
                
                <div className="flex justify-center mb-6">
                    <ShieldCheck className="w-16 h-16 animate-pulse" />
                </div>
                
                <h1 className="text-2xl font-bold mb-2 tracking-widest font-display">SECURE UPLINK ESTABLISHED</h1>
                <p className="text-xs text-emerald-700 uppercase mb-8">Blue Team Out-of-Band Channel</p>

                <div className="bg-black border border-emerald-900/50 p-4 text-left font-mono text-xs space-y-2 mb-8">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-3 h-3" />
                        <span>> PROTOCOL: OOB_REMEDIATION</span>
                    </div>
                    <div>> SOURCE: {searchParams.get('source') || 'BLUE_TEAM_LINK'}</div>
                    <div>> TARGET: {searchParams.get('instance')}</div>
                    <div className="text-emerald-300 animate-pulse">> STATUS: {status}...</div>
                </div>

                <div className="text-[10px] text-gray-500">
                    KING-HUD AUTOMATED DEFENSE SYSTEM
                </div>
            </div>
        </div>
    );
};
