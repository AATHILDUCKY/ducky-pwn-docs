import{c as n}from"./index-DDXeGDIl.js";/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]],i=n("shield-alert",a),r=()=>typeof window<"u"?window.electronAPI:void 0,c=async t=>{if(!t)return[];const e=r();if(e!=null&&e.getIssues)return e.getIssues(t);throw new Error("Electron API unavailable: issues require SQLite backend.")},u=async(t,e)=>{if(!t||!e)return;const s=r();if(s!=null&&s.saveIssue){await s.saveIssue(t,e);return}throw new Error("Electron API unavailable: issues require SQLite backend.")},l=async(t,e)=>{if(!t||!e)return;const s=r();if(s!=null&&s.deleteIssue){await s.deleteIssue(t,e);return}throw new Error("Electron API unavailable: issues require SQLite backend.")};export{i as S,l as d,c as f,u as p};
