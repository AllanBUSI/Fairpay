"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, User, Briefcase, Scale } from "lucide-react";
import { UserRole } from "@/app/generated/prisma/enums";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

interface ChatProps {
  procedureId: string;
  currentUserRole: UserRole;
  currentUserId: string;
  canComment: boolean;
  onMessageSent?: () => void; // Callback appelé après l'envoi d'un message
}

const roleIcons: Record<UserRole, typeof User> = {
  USER: User,
  JURISTE: Briefcase,
  AVOCAT: Scale,
};

const roleLabels: Record<UserRole, string> = {
  USER: "Utilisateur",
  JURISTE: "Juriste",
  AVOCAT: "Avocat",
};

export function Chat({ procedureId, currentUserRole, currentUserId, canComment, onMessageSent }: ChatProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    fetchComments();
    // Rafraîchir les commentaires toutes les 5 secondes
    const interval = setInterval(() => {
      fetchComments();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId]);

  useEffect(() => {
    // Scroll automatique uniquement au chargement initial ou si l'utilisateur a envoyé un message
    if (isInitialLoadRef.current || shouldAutoScrollRef.current) {
      setTimeout(() => {
        scrollToBottomInstant();
        shouldAutoScrollRef.current = false;
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [comments]);

  // Détecter si l'utilisateur scroll manuellement
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      
      // Si l'utilisateur scroll vers le bas, activer le scroll auto
      if (isNearBottom) {
        shouldAutoScrollRef.current = true;
      } else {
        // Si l'utilisateur scroll vers le haut, désactiver le scroll auto
        shouldAutoScrollRef.current = false;
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container && messagesEndRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const scrollToBottomInstant = () => {
    const container = messagesContainerRef.current;
    if (container && messagesEndRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "auto",
      });
    }
  };

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`/api/procedures/${procedureId}/comments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des commentaires:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending || !canComment) return;

    setSending(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Non authentifié");
        return;
      }

      const response = await fetch(`/api/procedures/${procedureId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du message");
      }

      setMessage("");
      // Activer le scroll auto après l'envoi d'un message
      shouldAutoScrollRef.current = true;
      // Rafraîchir les commentaires
      await fetchComments();
      // Appeler le callback pour rafraîchir la page parent (pour mettre à jour le statut)
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const UserIcon = roleIcons[currentUserRole] || User;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h3 className="font-semibold">Messages</h3>
        <p className="text-xs text-muted-foreground">
          {canComment ? "Vous pouvez envoyer des messages" : "Lecture seule"}
        </p>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Aucun message pour le moment.
              {canComment && <br />}
              {canComment && "Envoyez le premier message !"}
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const CommentUserIcon = roleIcons[comment.user.role] || User;
            const isCurrentUser = comment.user.id === currentUserId;

            return (
              <div
                key={comment.id}
                className={`flex gap-3 ${isCurrentUser ? "flex-row-reverse" : ""}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <CommentUserIcon className="h-4 w-4 text-primary" />
                </div>
                <div className={`flex-1 ${isCurrentUser ? "text-right" : ""}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {roleLabels[comment.user.role]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      isCurrentUser
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canComment && (
        <div className="border-t bg-card p-4">
          {error && (
            <div className="mb-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tapez votre message..."
              rows={3}
              className="resize-none"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !message.trim()} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Envoi..." : "Envoyer"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

