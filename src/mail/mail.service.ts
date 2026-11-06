import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ sent: boolean }> {
    const host = this.config.get<string>('smtpHost');
    const user = this.config.get<string>('smtpUser');
    const pass = this.config.get<string>('smtpPass');
    const from =
      this.config.get<string>('smtpFrom') ||
      user ||
      'Roots Café <noreply@rootscafe.local>';

    if (!host || !user || !pass) {
      this.logger.warn(
        `SMTP not configured — email to ${input.to} was not sent. Subject: ${input.subject}`,
      );
      this.logger.warn(input.text);
      return { sent: false };
    }

    const port = this.config.get<number>('smtpPort') ?? 587;
    const secure = this.config.get<boolean>('smtpSecure') ?? port === 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, '<br/>'),
    });
    return { sent: true };
  }
}
