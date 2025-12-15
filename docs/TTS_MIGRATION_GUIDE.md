# CLOVA Voice TTS - 백엔드 마이그레이션 가이드

현재 TTS 기능은 Vercel Serverless Function으로 구현되어 있습니다.
백엔드(NestJS)로 마이그레이션할 때 이 문서를 참고하세요.

## 현재 구조 (Serverless)

```
프론트엔드 → /api/tts → Vercel Function → CLOVA API
```

## 목표 구조 (백엔드)

```
프론트엔드 → /api/tts → NestJS Backend → CLOVA API
```

---

## 1. 환경변수 설정

백엔드 `.env` 파일에 추가:

```env
CLOVA_CLIENT_ID=your_client_id
CLOVA_CLIENT_SECRET=your_client_secret
```

---

## 2. NestJS 구현

### 2.1 DTO 생성

```typescript
// src/tts/dto/tts.dto.ts
import { IsString, IsOptional, IsNumber, Min, Max, MaxLength, IsIn } from 'class-validator';

export class TtsRequestDto {
  @IsString()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'nara', 'nminyoung', 'nyejin', 'mijin', 'jinho',
    'njonghyun', 'nwoosik', 'clara', 'matt'
  ])
  speaker?: string = 'nara';

  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(5)
  speed?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(5)
  pitch?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(-5)
  @Max(5)
  volume?: number = 0;

  @IsOptional()
  @IsIn(['mp3', 'wav'])
  format?: string = 'mp3';
}
```

### 2.2 Service 생성

```typescript
// src/tts/tts.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsRequestDto } from './dto/tts.dto';

@Injectable()
export class TtsService {
  private readonly CLOVA_API_URL = 'https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts';
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.getOrThrow('CLOVA_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow('CLOVA_CLIENT_SECRET');
  }

  async synthesize(dto: TtsRequestDto): Promise<Buffer> {
    const formData = new URLSearchParams({
      speaker: dto.speaker,
      text: dto.text,
      speed: dto.speed.toString(),
      pitch: dto.pitch.toString(),
      volume: dto.volume.toString(),
      format: dto.format,
    });

    const response = await fetch(this.CLOVA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-NCP-APIGW-API-KEY-ID': this.clientId,
        'X-NCP-APIGW-API-KEY': this.clientSecret,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TTS] CLOVA API error:', response.status, errorText);

      if (response.status === 401) {
        throw new HttpException('API 인증 실패', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if (response.status === 429) {
        throw new HttpException('요청 한도 초과', HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new HttpException('TTS 변환 실패', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

### 2.3 Controller 생성

```typescript
// src/tts/tts.controller.ts
import { Controller, Post, Body, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { TtsService } from './tts.service';
import { TtsRequestDto } from './dto/tts.dto';

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post()
  @Header('Content-Type', 'audio/mpeg')
  async synthesize(
    @Body() dto: TtsRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    const audioBuffer = await this.ttsService.synthesize(dto);

    const contentType = dto.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  }
}
```

### 2.4 Module 생성

```typescript
// src/tts/tts.module.ts
import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

@Module({
  controllers: [TtsController],
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
```

### 2.5 AppModule에 등록

```typescript
// src/app.module.ts
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [
    // ... 기존 모듈들
    TtsModule,
  ],
})
export class AppModule {}
```

---

## 3. 마이그레이션 체크리스트

- [ ] 네이버 클라우드 콘솔에서 CLOVA Voice API 활성화
- [ ] Application 등록 및 API Key 발급
- [ ] 백엔드 환경변수 설정 (CLOVA_CLIENT_ID, CLOVA_CLIENT_SECRET)
- [ ] TTS 모듈 생성 및 등록
- [ ] 프론트엔드 vercel.json에서 TTS rewrite 제거 (백엔드로 프록시되도록)
- [ ] 테스트

---

## 4. CLOVA API 요금

- 무료 티어: 없음 (유료 서비스)
- Premium: 1,000자당 4원
- Pro: 1,000자당 20원

월 비용 예상:
- 일 100건 × 500자 평균 = 50,000자/일
- 월 1,500,000자 × 4원/1000자 = **약 6,000원/월**

---

## 5. 참고 링크

- [CLOVA Voice API 가이드](https://api.ncloud-docs.com/docs/ai-naver-clovavoice)
- [CLOVA Voice Premium API](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)
- [네이버 클라우드 콘솔](https://console.ncloud.com/)

---

## 6. 삭제할 파일 (마이그레이션 완료 후)

```bash
rm api/tts.js
# vercel.json에서 /api/tts rewrite 규칙 제거
```
